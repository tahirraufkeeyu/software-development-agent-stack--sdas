---
name: infra-triage
description: Use when a platform incident is reported ("something's wrong with cluster X", alerts firing, user-facing degradation of unknown origin). Runs structured first-response triage — cluster health, then network or TLS branches as evidence demands, then incident comms if impact is user-facing.
safety: writes-shared
produces: infrastructure/reports/triage-<timestamp>.md
consumes:
  - infrastructure/findings/cluster-health.json
  - infrastructure/findings/network.json
  - infrastructure/findings/certs.json
chains:
  - cluster-health
  - network-diagnostics
  - ssl-certificate-manager
  - incident-response
---

## When to use

- A vague platform alarm has fired ("cluster X is degraded", "half our pods are unhappy", "certs expiring in 3 days").
- On-call has received a user-facing impact report and does not yet know whether the cause is nodes, network, or certs.
- A routine health sweep after a cloud-provider maintenance window or a CNI upgrade.
- Before any large change (Helm upgrade, node-pool recycle), to confirm the cluster baseline is sane.

Do not use for application-level debugging (use the owning service's logs), for cost/FinOps reviews, or for a known-cause incident where direct remediation is obvious — call `incident-response` or the specific skill directly.

## Chained skills

Executed as a decision tree, not a fixed sequence:

1. `cluster-health` — always runs first. Produces `infrastructure/findings/cluster-health.json` with node conditions, pod lifecycle counts, and a severity-ranked findings ladder.
2. `network-diagnostics` — runs only if `cluster-health` findings include any of: `DNS failure`, `service unreachable`, `NetworkUnavailable` node condition, CoreDNS CrashLoopBackOff, kube-proxy not ready on a node, or ingress controller 5xx surge.
3. `ssl-certificate-manager` — runs only if `cluster-health` or alerting surfaces: cert-manager `CertificateRequest` failures, `x509: certificate has expired` errors in pods, `Ingress` TLS secret missing, or a Prometheus `CertManagerCertExpirySoon` alert.
4. `incident-response` — runs only if user-facing impact is confirmed (5xx rate > SLO on a public service, customer tickets tied to the symptom, or status-page decision pending). Drives comms and draft postmortem.

## Inputs

- `cluster` — kubeconfig context or cluster name (single cluster per run).
- `alert_source` — optional: alert payload (PagerDuty/Alertmanager JSON) that kicked off the triage.
- `impact_scope` — `internal` | `user-facing` | `unknown`. Controls whether the `incident-response` branch can run.
- `critical_namespaces` — e.g. `[ingress, payments, kube-system]` to weight findings.
- `incident_window_minutes` — how far back to scan events and metrics (default 60).
- `remediation_mode` — `suggest` (default, read-only) | `act` (may restart pods, reapply secrets, rotate certs). `act` requires explicit caller consent per run.

## Outputs

- `infrastructure/reports/triage-<timestamp>.md` — the triage report with timeline, findings per stage, root-cause hypothesis, and remediation actions taken (or proposed).
- `infrastructure/findings/cluster-health.json` — always written.
- `infrastructure/findings/network.json` — written iff the network branch ran.
- `infrastructure/findings/certs.json` — written iff the TLS branch ran.
- If user-facing impact: `incidents/INC-YYYY-MM-DD-NN.md` draft from `incident-response`.
- A short Slack/Teams message suitable for `#platform-oncall`.

## Tool dependencies

- `kubectl` >= 1.27, `jq`, `yq`.
- `kubectl top` (metrics-server must be present).
- `dig`, `nslookup`, `curl`, `openssl`, `mtr` for the network branch.
- `cmctl` (cert-manager CLI), `openssl x509`, `step certificate` for the TLS branch.
- `helm` >= 3.12 (to inspect cert-manager / ingress releases).
- Optional: `stern`, `popeye`, `kubectl-neat`.
- Access to Prometheus for alert correlation.
- All tool requirements of chained skills are transitively required.

## Procedure

### 1. Establish baseline (chain: `cluster-health`)

```bash
kubectl config use-context "$CLUSTER"
kubectl version --short
kubectl get nodes -o wide
kubectl get --raw='/readyz?verbose' | head -40
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get events -A --sort-by=.lastTimestamp | tail -50
```

Persist normalized findings:

```bash
# cluster-health emits this shape:
jq -n '{
  cluster: "'$CLUSTER'",
  captured_at: "'$(date -u +%FT%TZ)'",
  node_conditions: [/* ... */],
  pod_states: { Running: 0, Pending: 0, CrashLoopBackOff: 0, ImagePullBackOff: 0 },
  findings: [
    { severity: "high", reason: "MemoryPressure", resources: ["node/ip-10-0-1-23"], hint: "kubectl describe node ip-10-0-1-23" }
  ]
}' > infrastructure/findings/cluster-health.json
```

### 2. Decide branches

```bash
NETWORK=$(jq -r '[.findings[].reason] | map(select(
  . == "DNSFailure" or . == "NetworkUnavailable"
  or . == "CoreDNSCrashLoop" or . == "KubeProxyNotReady"
  or . == "IngressSurge5xx"
)) | length > 0' infrastructure/findings/cluster-health.json)

TLS=$(jq -r '[.findings[].reason] | map(select(
  . == "CertExpiring" or . == "CertManagerRequestFailed"
  or . == "TLSSecretMissing" or . == "X509Expired"
)) | length > 0' infrastructure/findings/cluster-health.json)
```

### 3. Network branch (chain: `network-diagnostics`)

Only if `NETWORK=true`.

```bash
kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=200
kubectl run -n default --rm -it --image=nicolaka/netshoot netshoot-$$ \
  --restart=Never --command -- \
  sh -c 'dig +time=2 +tries=1 kubernetes.default.svc.cluster.local; \
         dig +time=2 +tries=1 example.com; \
         curl -sSI https://kubernetes.default.svc.cluster.local'

kubectl get endpoints -A | awk 'NR==1 || $3==""'   # services with no endpoints
```

Persist:

```bash
jq -n '{
  captured_at: "'$(date -u +%FT%TZ)'",
  dns: { intra_cluster_ms: 2, external_ms: 14, errors: [] },
  endpoints_without_backends: [],
  coredns_pod_states: { Running: 2, CrashLoopBackOff: 0 }
}' > infrastructure/findings/network.json
```

### 4. TLS branch (chain: `ssl-certificate-manager`)

Only if `TLS=true`.

```bash
cmctl status -n cert-manager
kubectl get certificates -A -o wide
kubectl get certificaterequests -A --sort-by=.metadata.creationTimestamp \
  | tail -20

# For each Ingress TLS secret:
for s in $(kubectl get secret -A -o json \
  | jq -r '.items[] | select(.type=="kubernetes.io/tls") | "\(.metadata.namespace)/\(.metadata.name)"'); do
  NS=${s%/*}; NAME=${s#*/}
  kubectl -n "$NS" get secret "$NAME" -o jsonpath='{.data.tls\.crt}' \
    | base64 -d \
    | openssl x509 -noout -subject -enddate
done
```

Persist:

```bash
jq -n '{
  captured_at: "'$(date -u +%FT%TZ)'",
  cert_manager_ready: true,
  expiring_within_days: [
    { ns: "ingress", name: "api-tls", not_after: "2026-04-22T00:00:00Z", days: 3 }
  ],
  failed_requests: []
}' > infrastructure/findings/certs.json
```

### 5. Correlate and hypothesize root cause

Cross-reference the three JSON files:

- Node MemoryPressure + pod OOMKill on the same namespace => resource-request / HPA issue.
- `DNSFailure` + CoreDNS CrashLoopBackOff + node NetworkUnavailable => CNI regression.
- `CertManagerRequestFailed` + ACME `DNS-01` errors => upstream DNS provider (Cloudflare/Route53) token or zone issue.

Pick the single most likely root cause and record an ordered remediation plan.

### 6. Impact decision (chain: `incident-response`)

```bash
if [ "$IMPACT_SCOPE" = "user-facing" ]; then
  # incident-response reads the three findings JSONs, drafts:
  #   - status-page update
  #   - #platform-oncall summary
  #   - postmortem skeleton with timeline pre-populated from findings timestamps
  :
fi
```

Skip entirely when `impact_scope=internal` — triage report still written, no incident record created.

### 7. Remediation

In `remediation_mode=suggest` (default): the report lists exact commands.
In `remediation_mode=act`: the orchestrator may execute low-risk commands:

```bash
# Examples of act-mode remediations; each is opt-in and logged in the report.
kubectl -n "$NS" rollout restart deploy/"$DEPLOY"
kubectl -n cert-manager delete pod -l app=cert-manager
cmctl renew -n ingress api-tls
```

Destructive actions (`kubectl delete node`, secret rotation, helm rollback) require an explicit flag beyond `act` and are never taken by default.

### 8. Write the triage report

`infrastructure/reports/triage-<timestamp>.md` (UTC, e.g. `triage-20260419T142300Z.md`) always includes:

- Header: cluster, start/end UTC, operator, alert source, impact scope.
- Timeline: ordered list of each check executed with timestamp and outcome.
- Findings per stage: cluster / network / tls tables with severity and resource.
- Root-cause hypothesis: single sentence, with evidence pointers.
- Remediation: commands run (act mode) or proposed (suggest mode), each with expected effect.
- Links: dashboards, alert URL, incident record (if created).
- Next steps and owner.

## Examples

### Example 1 — node pressure

Alert: `KubeNodeMemoryPressure` on 2 of 6 nodes in `prod-use1`.

Flow:
- `cluster-health` captures:
  - Two nodes report `MemoryPressure=True`.
  - 14 pods in `payments` namespace show `OOMKilled` in the last hour.
  - `kubectl describe node ip-10-0-1-23` shows `memory requests: 94%`.
- Branching: `NETWORK=false`, `TLS=false`. Neither branch runs.
- Root-cause hypothesis: over-provisioned workload `payments/order-reconciler` with `requests.memory: 2Gi` but P95 usage `3.8Gi` and no HPA.
- Remediation (suggest): raise requests to `4Gi`, add HPA with `memory=70%` target, cordon/drain one node to verify recovery.

Report `infrastructure/reports/triage-20260419T091200Z.md` contains kubectl evidence, `kubectl top pod -n payments --sort-by=memory`, and the exact HPA manifest to apply. `impact_scope=internal` so `incident-response` is not called.

### Example 2 — cert expiry cascade

Alert: Prometheus `CertManagerCertExpirySoon` — `ingress/api-tls` expires in 3 days.

Flow:
- `cluster-health` finds `cert-manager-controller` pod `Running` but flags `CertificateRequest ingress/api-tls-xyz` status `False` for 18 hours. Finding reason: `CertManagerRequestFailed`.
- Branching: `TLS=true`, `NETWORK=false` (no DNS or kube-proxy symptoms).
- `ssl-certificate-manager` audit: ACME order stuck at `pending`, challenge type `DNS-01`, error `unauthorized: Incorrect TXT record for _acme-challenge.api.example.com`.
- Correlation: Cloudflare API token rotated 2 days ago; `cert-manager-webhook-cloudflare` secret still holds the old token.
- `impact_scope=user-facing` because expiry in 3 days will break the public API — `incident-response` drafts a low-severity incident record and a status-page heads-up.
- Remediation (act mode, with consent): rotate the `cloudflare-api-token` secret, restart cert-manager webhook, `cmctl renew ingress/api-tls`. Certificate issued within 4 minutes.

Report contains the failing `CertificateRequest` YAML, the `dig TXT _acme-challenge.api.example.com` output before and after, and the full chain of skill calls.

## Constraints

- Never run the TLS or network branches if their triggers were not set — extra commands noise the timeline and burn on-call attention.
- Never call `incident-response` when `impact_scope=internal`; it would create a paging incident for a non-incident.
- Never take destructive remediation actions (`kubectl delete node`, `helm rollback`, secret deletion) in default mode. Even in `act` mode, these require a second explicit flag.
- Do not overwrite prior triage reports; timestamps in filenames guarantee uniqueness.
- Do not proceed without a valid kubeconfig context; abort with a clear error.
- `writes-shared` safety level: this skill may modify cluster state in `act` mode; every such action is logged in the report with before/after evidence.
- All findings must come from live cluster queries, not cached JSON; stale findings produce wrong root causes.

## Quality checks

- `cluster-health.json` schema validates: `cluster`, `captured_at`, `node_conditions`, `pod_states`, `findings[]` all present.
- Branch decisions match the rule table in step 2 (no branch ran without a trigger reason recorded).
- If `network.json` exists, it contains real `dig`/`curl` output, not placeholders.
- If `certs.json` exists, every listed cert has a real `openssl x509 -enddate` reading.
- Every remediation command in the report is syntactically valid (shellcheck-clean) and names real resources.
- Report includes a timeline where every stage has UTC start and end timestamps.
- If an incident was created, it is linked from the triage report and vice versa.
- Total triage wall-clock time is recorded for on-call MTTA/MTTR tracking.
