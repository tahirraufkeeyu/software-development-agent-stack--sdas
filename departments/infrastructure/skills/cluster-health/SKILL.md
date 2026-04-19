---
name: cluster-health
description: Use when a user wants a Kubernetes cluster health check, says "is the cluster healthy", "something is off with the cluster", inherits an unfamiliar cluster, or is triaging an ongoing incident. Walks node conditions, control-plane components, resource pressure, critical DaemonSets, pod lifecycle states, and recent events, then produces a severity-ranked issue list.
safety: safe
---

## When to use

- User inherits a cluster and wants a baseline report.
- Alerts are firing but the root cause is unclear — need a structured triage before drilling into a single service.
- Before running any changes (Helm upgrade, CNI swap, node pool recycle), confirm the cluster is green.
- Post-incident: validate that the cluster is back to baseline.
- Recurring "some pods are weird" complaints that need systematic triage.

Do not use this skill for application-level debugging (use the owning service's logs), for cloud-provider outages (check provider status page), or for cost reviews (separate skill).

## Inputs

- Kubeconfig context (single cluster per run; run again per context for multi-cluster estates).
- Optional: list of critical namespaces to give extra weight (e.g. `payments`, `ingress`, `kube-system`).
- Optional: an incident time window to focus event triage on.

## Outputs

A report with these sections:

1. Cluster summary: version, node count, region, CNI, ingress controller.
2. Node table: `node | role | version | conditions | CPU util | mem util | disk util | PID util | age`.
3. Control-plane check: API server reachability, scheduler, controller-manager, etcd (or managed control plane indicators), admission webhooks.
4. Critical DaemonSets: CNI, CSI, kube-proxy, node-exporter, log shipper, cert-manager, ingress. `ready / desired` per DaemonSet.
5. Pod lifecycle: counts of `Running`, `Pending`, `CrashLoopBackOff`, `ImagePullBackOff`, `Error`, `Terminating`.
6. Event triage: last 1 h of `Warning`-level events grouped by reason.
7. Findings ladder: `blocker` / `high` / `medium` / `low` / `info`, each with a concrete command or manifest fix.

## Tool dependencies

- `kubectl` (≥ 1.27), `jq`, `yq`.
- `kubectl top` (requires metrics-server).
- `kubectl-neat`, `stern` optional for prettier output.
- Kubernetes MCP for batched list/describe.
- Optional: `kubeval`, `kube-score`, `popeye` for deeper static checks.

## Procedure

1. Capture cluster basics:
   ```
   kubectl version --short
   kubectl cluster-info
   kubectl get nodes -o wide
   kubectl get --raw='/readyz?verbose' | head -40
   ```
   Note the server version and any deprecation warnings.

2. Node conditions:
   ```
   kubectl get nodes -o json | jq -r '
     .items[] | [
       .metadata.name,
       (.status.conditions[] | select(.type=="Ready") | .status),
       (.status.conditions[] | select(.type=="MemoryPressure") | .status),
       (.status.conditions[] | select(.type=="DiskPressure") | .status),
       (.status.conditions[] | select(.type=="PIDPressure") | .status),
       (.status.conditions[] | select(.type=="NetworkUnavailable") | .status // "False")
     ] | @tsv'
   ```
   Any `MemoryPressure=True`, `DiskPressure=True`, `PIDPressure=True`, or `Ready=False` for more than a few minutes is a `high` finding.

3. Resource utilisation:
   ```
   kubectl top nodes
   kubectl top pods -A --sort-by=cpu | head -30
   kubectl top pods -A --sort-by=memory | head -30
   # Allocatable vs requests to spot scheduling pressure
   kubectl get nodes -o json | jq -r '
     .items[] | .metadata.name + " alloc-cpu=" + .status.allocatable.cpu +
                " alloc-mem=" + .status.allocatable.memory'
   kubectl get pods -A -o json | jq -r '
     [.items[].spec.containers[].resources.requests.cpu // "0"]
     | map(sub("m$";"") | tonumber) | add'
   ```
   Cluster-wide CPU requests > 85% of allocatable is a `high` finding: the next deploy will Pending.

4. Control-plane checks (managed cluster: skip etcd, but keep the health endpoints):
   ```
   kubectl get --raw='/healthz'
   kubectl get --raw='/livez?verbose' | tail
   kubectl -n kube-system get pods -l tier=control-plane
   kubectl get componentstatuses        # deprecated but still informative on self-managed
   kubectl get apiservice | grep -v True   # non-Available aggregated APIs
   kubectl get validatingwebhookconfiguration,mutatingwebhookconfiguration
   ```
   A non-Available APIService or a ValidatingWebhook pointing at a down service will break `kubectl apply` silently. That is `blocker`.

5. Critical DaemonSets:
   ```
   kubectl get ds -A -o json | jq -r '
     .items[] | select(.status.numberReady < .status.desiredNumberScheduled) |
     [.metadata.namespace, .metadata.name,
      (.status.numberReady|tostring) + "/" + (.status.desiredNumberScheduled|tostring)] | @tsv'
   ```
   Any DS below desired is at minimum `high`; for CNI/CSI/kube-proxy it is `blocker`.

6. Pod lifecycle:
   ```
   kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded -o wide
   kubectl get pods -A -o json | jq -r '
     .items[] |
     select(
       (.status.containerStatuses // []) |
       map(.state.waiting.reason? // "" ) |
       any(. == "CrashLoopBackOff" or . == "ImagePullBackOff" or . == "ErrImagePull" or . == "CreateContainerConfigError")
     ) | [.metadata.namespace, .metadata.name,
          ((.status.containerStatuses // [])[0].state.waiting.reason // "-")] | @tsv'
   ```
   Classify:
   - `CrashLoopBackOff`: `high` — pull logs (`kubectl logs --previous`) and last 20 events for that pod.
   - `ImagePullBackOff` / `ErrImagePull`: `high` — verify image tag, registry creds (`kubectl get secret ... -o json`), and imagePullSecrets on the pod spec.
   - `Pending` for > 5 min: `medium` unless the namespace is Tier 1 — then `high`. Root causes: no node fits resources, tainted nodes with no tolerations, PVC unbound, PodSecurity admission rejection.
   - `CreateContainerConfigError`: `high` — usually a missing Secret or ConfigMap.
   - `Terminating` for > 10 min: `medium` — finalizer stuck; inspect `metadata.finalizers`.

7. PersistentVolume check:
   ```
   kubectl get pv -o wide
   kubectl get pvc -A | grep -v Bound
   ```
   Any PVC `Pending` for more than 10 min is `high` if it blocks a Tier 1 pod.

8. Events in the last hour:
   ```
   kubectl get events -A --sort-by=.lastTimestamp \
     | awk -v cutoff="$(date -u -d '1 hour ago' +%FT%T 2>/dev/null || date -u -v-1H +%FT%T)" \
       '$1 >= cutoff || NR==1' | head -80
   kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp \
     | awk '{print $5}' | sort | uniq -c | sort -rn | head -20
   ```
   The `uniq -c` output shows the dominant warning reasons (`FailedScheduling`, `BackOff`, `Unhealthy`, `FailedMount`). Each deserves a finding.

9. Version / deprecation:
   ```
   kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis | grep -v '0$' | head
   ```
   Any non-zero counter means something is still calling a deprecated API and will break on upgrade. `medium`.

10. Produce the report using the ladder:
    - `blocker` → fix before any other change. API server non-ready, etcd unhealthy, >1 control-plane node down, CNI DS failing.
    - `high` → fix today. Node under DiskPressure, DS below desired on any namespace, CrashLoopBackOff in Tier 1 namespace, > 85% CPU requests cluster-wide.
    - `medium` → fix this week. CrashLoopBackOff in Tier 2/3, deprecated APIs, Pending pods in non-Tier 1.
    - `low` → backlog. Suboptimal resource requests, missing readiness probes.
    - `info` → observation; no action.

## Examples

### Happy path: inherited 12-node EKS, first health check

Report excerpt:

```
Cluster:  EKS 1.29, 12 nodes (3 system m6i.large, 9 workload m6i.xlarge), eu-west-1, VPC CNI, nginx-ingress 1.10.
Nodes:    12/12 Ready. All pressure conditions False.
Top util: ip-10-0-3-21 CPU 78%, mem 66% (hot node: payments-api).
Control:  /readyz ok. 1 APIService non-Available: v1beta1.metrics.k8s.io.
DS:       22 DaemonSets, 21/22 fully ready; node-exporter 11/12 (one node failed CSI mount).
Pods:     412 Running, 0 Pending, 2 CrashLoopBackOff in staging, 0 ImagePullBackOff.
Events:   Top warnings: BackOff x18 (staging/checkout), FailedScheduling x3 (batch namespace).

Findings
| high   | monitoring      | APIService metrics.k8s.io non-Available         | kubectl -n kube-system rollout restart deploy metrics-server |
| high   | payments        | Hot node at 78% CPU; single-AZ single replica   | Scale payments-api to 3 replicas with topologySpreadConstraints across AZs |
| medium | staging         | checkout in CrashLoopBackOff (OOMKilled)        | Bump memory limit from 256Mi to 512Mi; investigate leak |
| medium | batch           | FailedScheduling (no node with 16 GiB free)     | Add c6i.2xlarge node group or reduce job memory request |
| low    | monitoring      | node-exporter DS 11/12                          | Investigate csi-node on ip-10-0-7-84; likely kubelet cert rotation |
| info   | -               | kube-proxy 1.28 on 1.29 cluster                 | Plan upgrade to 1.29 minor to match |
```

### Edge case: cluster looks healthy but deploys are silently rejected

Every query returns green. Nodes Ready, pods Running, events quiet. But the user reports `kubectl apply -f deploy.yaml` "says configured but nothing changes".

Diagnosis path:

1. Check mutating/validating webhooks:
   ```
   kubectl get mutatingwebhookconfigurations,validatingwebhookconfigurations
   ```
   Finding: `validatingwebhookconfiguration/old-policy-controller` points at a Service (`policy-webhook.svc`) whose Pod was deleted last week. With `failurePolicy: Ignore`, `kubectl apply` returns success but the object is silently mutated or dropped upstream; with `failurePolicy: Fail`, apply errors loudly (better). Here it is `Ignore` and the webhook mutates away the spec changes.
2. Fix: either restore the policy-webhook service or delete the stale webhook configuration.

This is a `blocker` finding: the cluster is unmanageable until resolved. It is also invisible on every dashboard.

## Constraints

- Never mutate the cluster during a health check without user confirmation. The output is read-only advice.
- Never run `kubectl drain` or `kubectl delete node` as part of diagnosis.
- Never conclude "healthy" while any `blocker` or `high` finding is open.
- Never over-index on a single snapshot; if pods are mid-rollout, say so and recheck.
- Never cite a finding without the command or `kubectl` output that evidenced it.
- Never blindly run `kubectl get pods -A -o yaml` on large clusters; it can OOM your shell. Use field selectors and jq.

## Quality checks

- Every node's conditions are reported (not just "all Ready").
- Control-plane `/readyz` and aggregated APIServices are checked.
- DaemonSet `ready / desired` is reported for every DS in `kube-system` and any namespace hosting CNI/CSI/ingress/observability.
- Pod findings include `kubectl logs --previous` output (or a note that logs are unavailable) for every CrashLoopBackOff.
- Warning-event reasons are grouped and counted, not listed raw.
- Deprecated-API counter is checked before the next upgrade window.
- Every finding has a severity, a namespace/node scope, and a concrete fix command or manifest.
- The verdict (`healthy` / `degraded` / `unhealthy`) is consistent with the severities present.
