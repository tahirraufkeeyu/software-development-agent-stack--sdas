---
name: deploy
description: Use when rolling out a new version of a service to staging or production. Runs tests, builds and pushes a container, performs a blue/green or canary rollout with health gates, and rolls back automatically on SLO breach.
safety: destructive
supported-stacks:
  - helm+k8s
  - kubernetes
---

## When to use

- Promoting a release candidate to staging or production.
- Cutting over a blue/green stack after a schema migration.
- Running a canary at 5/25/50/100 percent with automated rollback.
- Any deploy that crosses an environment boundary guarded by approvals or SLOs.

Do not use for local `kubectl apply` against a dev cluster or for one-off hotfixes that bypass CI. For those, use `kubectl rollout` directly and document why.

## Inputs

- `service` — Kubernetes Deployment/StatefulSet name (e.g. `checkout-api`).
- `namespace` — target namespace (e.g. `prod-us-east-1`).
- `image` — fully qualified image reference (`ghcr.io/acme/checkout-api:sha-abc1234`).
- `strategy` — `canary` | `blue-green` | `rolling`.
- `chart_path` — path to the Helm chart used for this service.
- `values_file` — environment-specific values (e.g. `values-prod.yaml`).
- `slo` — an object: `{ error_rate_max: 0.01, p95_latency_ms: 400, window_minutes: 5 }`.
- `canary_steps` — list of percentages, e.g. `[5, 25, 50, 100]` (canary only).
- `approvers` — GitHub environment approvers list for prod.

## Outputs

- Rollout status summary (revision before/after, pods ready, traffic split).
- Prometheus/Datadog query results that the gate evaluated.
- Git SHA deployed, image digest, and Helm release revision.
- If rolled back: the triggering SLO metric, timestamp, and `helm rollback` output.
- A Markdown deploy note suitable for posting to `#deploys`.

## Tool dependencies

- `kubectl` >= 1.28, context already set to target cluster.
- `helm` >= 3.12.
- `docker` or `buildx` for the image build step.
- `cosign` if the registry policy requires signed images.
- `jq`, `yq` for parsing outputs.
- Access to Prometheus (or Datadog/CloudWatch) for SLO queries.
- GitHub CLI (`gh`) when the deploy is gated by a protected environment.
- Optional: Argo Rollouts (`kubectl argo rollouts`) if the project uses it.

## Project scripts you supply

The procedure below shells out to two project-side scripts. They're not shipped by this skill — drop them in your repo at `./scripts/` (or adjust the paths). Section 7 below documents the exact query contract `check-slo.sh` must satisfy; `smoke.sh` is a thin wrapper around your service's existing health/smoke endpoint.

- `./scripts/smoke.sh <base-url>` — exits 0 when the service is healthy at that URL, non-zero otherwise.
- `./scripts/check-slo.sh <service> <step-percent>` — exits 0 when error-rate and p95 latency are within SLO for the configured window, non-zero otherwise.

## Procedure

### 0. Detect the stack

Before pre-flight, confirm this skill is the right tool for the target:

```bash
kubectl config current-context                                    # must return a context
kubectl auth can-i create deployments -n "$NAMESPACE" 2>/dev/null  # must be yes
helm version --short 2>/dev/null                                  # Helm 3.x
ls argocd/ fluxcd/ kustomize/ 2>/dev/null | head                  # GitOps layer in play?
grep -l 'serverless\|sam\|fargate' serverless.yml template.yaml 2>/dev/null | head  # non-K8s?
```

This skill supports `helm+k8s` and `kubernetes` canary / blue-green rollouts. If detection shows:
- an ArgoCD / Flux GitOps workflow already in place — stop and recommend a Git-commit-driven promotion instead of imperative helm upgrade
- AWS Lambda, Fargate-only, Google Cloud Run, Azure Container Apps, or any serverless platform — this skill does not apply; report and suggest a platform-specific deploy skill
- no Kubernetes context at all — stop

### 1. Pre-flight

```bash
kubectl config current-context
kubectl -n "$NAMESPACE" get deploy "$SERVICE" -o jsonpath='{.spec.template.spec.containers[0].image}'
helm -n "$NAMESPACE" history "$SERVICE"
git rev-parse --short HEAD
```

Abort if:
- Current context is not the expected cluster.
- Helm release is in `pending-upgrade` or `failed` state (run `helm rollback` first).
- There is an open incident tagged `service:$SERVICE` (check PagerDuty/Opsgenie).

Walk the `deployment-checklist.md` reference and confirm every pre-deploy item.

### 2. Build and push the image

```bash
IMAGE="ghcr.io/${ORG}/${SERVICE}:sha-$(git rev-parse --short HEAD)"
docker buildx build \
  --platform linux/amd64 \
  --tag "$IMAGE" \
  --label org.opencontainers.image.revision="$(git rev-parse HEAD)" \
  --label org.opencontainers.image.source="https://github.com/${ORG}/${SERVICE}" \
  --provenance=true \
  --sbom=true \
  --push .

cosign sign --yes "$IMAGE"
DIGEST=$(cosign triangulate "$IMAGE" | sed 's/.*@//')
```

Pin by digest in the Helm values (`image.digest: sha256:...`), not by tag.

### 3. Run tests

```bash
make test
make integration-test
trivy image --exit-code 1 --severity HIGH,CRITICAL "$IMAGE"
```

Do not proceed if any step fails. Surface failing test names to the user.

### 4. Staging smoke

```bash
helm -n staging upgrade --install "$SERVICE" "$CHART_PATH" \
  -f values-staging.yaml \
  --set image.repository="ghcr.io/${ORG}/${SERVICE}" \
  --set image.digest="$DIGEST" \
  --atomic --timeout 5m --wait

kubectl -n staging rollout status deploy/"$SERVICE" --timeout=5m
./scripts/smoke.sh "https://staging.${SERVICE}.example.com"
```

### 5. Request prod approval

```bash
gh workflow run deploy-prod.yml \
  -f service="$SERVICE" \
  -f image_digest="$DIGEST" \
  -f strategy="$STRATEGY"
```

The `production` GitHub Environment must require at least one approver (see `pipeline-builder` reference).

### 6. Rollout

**Canary (Argo Rollouts):**

```bash
kubectl -n "$NAMESPACE" argo rollouts set image "$SERVICE" \
  "$SERVICE=${IMAGE}@${DIGEST}"

for step in 5 25 50 100; do
  kubectl -n "$NAMESPACE" argo rollouts promote "$SERVICE"
  kubectl -n "$NAMESPACE" argo rollouts status "$SERVICE" --timeout 10m
  ./scripts/check-slo.sh "$SERVICE" "$step" || {
    kubectl -n "$NAMESPACE" argo rollouts abort "$SERVICE"
    kubectl -n "$NAMESPACE" argo rollouts undo "$SERVICE"
    exit 1
  }
done
```

**Blue/green with Helm:**

```bash
helm -n "$NAMESPACE" upgrade --install "${SERVICE}-green" "$CHART_PATH" \
  -f "$VALUES_FILE" \
  --set image.digest="$DIGEST" \
  --set color=green \
  --atomic --timeout 10m --wait

./scripts/check-slo.sh "${SERVICE}-green" 100 || { helm uninstall "${SERVICE}-green" -n "$NAMESPACE"; exit 1; }

kubectl -n "$NAMESPACE" patch svc "$SERVICE" \
  -p '{"spec":{"selector":{"color":"green"}}}'

sleep 300  # soak
./scripts/check-slo.sh "$SERVICE" 100 || {
  kubectl -n "$NAMESPACE" patch svc "$SERVICE" -p '{"spec":{"selector":{"color":"blue"}}}'
  exit 1
}

helm -n "$NAMESPACE" uninstall "${SERVICE}-blue"
```

**Rolling (simple services only):**

```bash
helm -n "$NAMESPACE" upgrade --install "$SERVICE" "$CHART_PATH" \
  -f "$VALUES_FILE" --set image.digest="$DIGEST" \
  --atomic --timeout 10m --wait
kubectl -n "$NAMESPACE" rollout status deploy/"$SERVICE"
```

### 7. SLO gate (`scripts/check-slo.sh`)

Query Prometheus for the configured window. Example query contract:

```
error_rate   = sum(rate(http_requests_total{service="$SERVICE",status=~"5.."}[5m]))
             / sum(rate(http_requests_total{service="$SERVICE"}[5m]))
p95_latency  = histogram_quantile(0.95,
                 sum by (le) (rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m])))
```

Fail the gate if `error_rate > slo.error_rate_max` or `p95_latency > slo.p95_latency_ms / 1000`.

### 8. Rollback

```bash
helm -n "$NAMESPACE" history "$SERVICE"
helm -n "$NAMESPACE" rollback "$SERVICE" <previous-revision> --wait --timeout 10m
kubectl -n "$NAMESPACE" rollout status deploy/"$SERVICE"
```

If the rollout used Argo:

```bash
kubectl -n "$NAMESPACE" argo rollouts undo "$SERVICE"
```

Post the rollback reason and metric values to `#deploys` and page the service owner.

### 9. Post-deploy

- Confirm dashboards are green for 15 minutes.
- Close the deploy ticket with image digest and Helm revision.
- If any feature flag was flipped, file a ticket to remove the flag once stable.

## Examples

### Example 1 — Canary rollout of `checkout-api` to prod

Inputs:

```yaml
service: checkout-api
namespace: prod-us-east-1
strategy: canary
chart_path: ./charts/checkout-api
values_file: values-prod.yaml
slo: { error_rate_max: 0.005, p95_latency_ms: 300, window_minutes: 5 }
canary_steps: [5, 25, 50, 100]
approvers: ["@acme/sre"]
```

Expected flow: build+sign image, staging deploy + smoke, request approval, promote canary through `5 -> 25 -> 50 -> 100`, run SLO check after each step, emit deploy note.

### Example 2 — Blue/green after schema migration

`payments-api` ships a new column. Migration has already run as a separate PR (expand phase). Deploy uses `strategy: blue-green` so both versions can read/write while the cut happens atomically at the Service selector. If p95 latency on `green` exceeds 300 ms during the 5-minute soak, selector is flipped back to `blue` and `green` is uninstalled.

## Constraints

- Do not produce output for a stack outside `supported-stacks`. If detection shows an ArgoCD/Flux GitOps path, a serverless platform (Lambda / Fargate-only / Cloud Run / Container Apps), or no Kubernetes at all, STOP and report. This skill's canary/blue-green logic assumes Kubernetes primitives; forcing it onto another platform produces unusable output.
- Never deploy untagged `latest`; always pin by image digest.
- Never skip the staging step for prod deploys, even for config-only changes.
- Never roll forward to fix a failing deploy during business hours; roll back first, then diagnose.
- Do not run `helm upgrade` without `--atomic`. Without it, failed upgrades leave the release in a broken state.
- Do not grant `cluster-admin` to the deploy service account; bind a namespace-scoped `Role` with only the verbs needed (`get/list/watch/create/update/patch` on `deployments`, `services`, `configmaps`, `secrets`, `ingresses`).
- If the project uses GitOps (Argo CD/Flux), this skill produces the commit that updates the image digest in the env repo; it does not `kubectl apply` directly.

## Quality checks

- `helm lint "$CHART_PATH"` passes.
- `helm template ... | kubeconform -strict -` passes against target cluster API version.
- Image is signed (`cosign verify ...`) and passes `trivy image --severity HIGH,CRITICAL`.
- Rollout watcher returned within `--timeout`; no pods stuck `CrashLoopBackOff` or `ImagePullBackOff`.
- SLO gate evaluated with real Prometheus output, not a mocked value.
- `kubectl -n "$NAMESPACE" rollout history deploy/"$SERVICE"` shows the new revision at the top.
- Deploy note includes: service, env, old digest, new digest, Helm revision, canary steps + metrics, approver, timestamp (UTC).
