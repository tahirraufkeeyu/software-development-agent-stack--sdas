---
name: incident-response
description: Use when an alert fires, a customer reports an outage, or a deploy goes sideways. Guides triage across logs (kubectl, CloudWatch, Loki), identifies the failing component, confirms blast radius, drives Slack status updates, and produces a blameless postmortem.
safety: writes-shared
---

## When to use

- A pager just went off and severity is unclear.
- Production is degraded and the on-call needs a structured loop.
- A deploy triggered an SLO breach and you need to decide roll-back vs. roll-forward.
- After mitigation, to draft the postmortem while memory is fresh.

Do not use for general debugging of a feature bug in dev — use the `engineering:debug` skill. Do not use for known-good maintenance work.

## Inputs

- `alert` — alert title, dashboard link, and first-firing timestamp (UTC).
- `service` — service name impacted (or `unknown` if still triaging).
- `environment` — `prod` | `staging` | multi-region (`us-east-1`, `eu-west-1`).
- `symptoms` — observed customer impact: errors, latency, outage, partial.
- `recent_changes` — last 3 deploys and last 3 infra changes (get from CI history).
- `log_sources` — which of `kubectl`, CloudWatch, Loki, Datadog, Splunk are available.
- `severity_guess` — initial guess (SEV1 total outage, SEV2 major degradation, SEV3 minor).

## Outputs

- Triage notes captured in the incident channel (timestamped lines).
- Confirmed severity and blast radius.
- Mitigation action taken with evidence that it worked.
- Slack status updates (initial, update every 30 min during active, resolution).
- Draft postmortem using `references/postmortem-template.md` within 24 hours of resolution.

## Tool dependencies

- `kubectl` with context set to the affected cluster.
- `helm` for rollback.
- AWS CLI / `az` / `gcloud` for cloud-side evidence.
- `logcli` (Loki) or cloud log CLIs (`aws logs tail`, `az monitor`).
- `promtool`/`curl` to hit Prometheus.
- `gh` CLI to pull recent deploys.
- Slack MCP or webhook for status posts.

## Procedure

### 0. Declare

Open (or acknowledge) an incident in PagerDuty/Opsgenie. Create a dedicated Slack channel: `#inc-<yyyymmdd>-<short-desc>`. Assign roles:

- **Incident Commander (IC)** — decisions, communication.
- **Ops lead** — runs the procedure below.
- **Scribe** — timestamped notes into the channel (UTC).
- **Comms** — external status page + customer comms.

For a solo pager, one person covers IC + Ops + Scribe; still run the loop.

### 1. Initial Slack update (within 5 minutes)

```
:rotating_light: Incident declared
Severity: SEV2 (suspected)
Service: checkout-api
Impact: ~10% of checkout requests returning 5xx since 14:32 UTC
IC: @alice   Ops: @bob
Channel: #inc-20260419-checkout-5xx
Status page: updating now
Next update: 15:05 UTC
```

### 2. Gather evidence

Run in parallel; capture command + output into the channel.

```bash
# Recent deploys
gh run list -R acme/checkout-api --workflow deploy.yml --limit 5

# Helm history
helm -n prod history checkout-api | head

# Pod status
kubectl -n prod get pods -l app.kubernetes.io/name=checkout-api -o wide
kubectl -n prod top pods -l app.kubernetes.io/name=checkout-api

# Recent events
kubectl -n prod get events --sort-by=.lastTimestamp | tail -30

# Application logs (last 15 min, ERROR or higher)
kubectl -n prod logs -l app.kubernetes.io/name=checkout-api \
  --since=15m --tail=2000 --prefix --timestamps \
  | grep -iE 'error|panic|fatal|5[0-9]{2}' | head -100

# CloudWatch (if logs ship there)
aws logs tail /aws/containerinsights/prod/application \
  --since 15m --filter-pattern '{ $.service = "checkout-api" && $.level = "ERROR" }' --format short

# Loki
logcli query --since=15m --limit=500 \
  '{namespace="prod", app="checkout-api"} |= "ERROR"'

# Prometheus — error rate and p95 latency
curl -sG "${PROM}/api/v1/query" \
  --data-urlencode 'query=sum(rate(http_requests_total{service="checkout-api",status=~"5.."}[5m])) / sum(rate(http_requests_total{service="checkout-api"}[5m]))'

curl -sG "${PROM}/api/v1/query" \
  --data-urlencode 'query=histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{service="checkout-api"}[5m])))'
```

Also check:
- Dependency dashboards (DB CPU, queue lag, cache hit rate).
- Recent infra changes (`terraform show`, Azure Activity Log, CloudTrail).
- Whether the alert is isolated to one AZ/node/region.

### 3. Identify the failing component

Use a decision tree:

- Errors only on pods from the new ReplicaSet? -> bad deploy.
- Errors tied to DB timeouts? -> DB side (check CPU, slow query log, locks).
- Errors from upstream caller only? -> ingress/LB or client-side TLS/DNS.
- Errors in one AZ only? -> suspect AZ failure, cordon nodes.
- Queue depth rising, no consumer errors? -> consumer throughput/capacity.

Document the single hypothesis you are acting on. If wrong, rewind.

### 4. Confirm blast radius

- Percentage of requests affected (from Prometheus).
- Customer segments affected (authenticated vs anonymous, region, plan tier).
- Whether data is being written incorrectly (worse than errors — check).
- Whether downstream services are also degrading.

Re-evaluate severity with the real number. Upgrade/downgrade as needed.

### 5. Communicate

Slack update every 30 minutes while active, plus on any major status change:

```
Update 15:05 UTC
Impact: still ~10% of checkout requests failing
Hypothesis: last deploy (sha-7f3a9c1) introduced regression; rolling back now
ETA mitigation: 10 min
Next update: 15:20 UTC or sooner
```

Status page update matches the Slack message in tone but stays customer-facing (no internal service names).

### 6. Mitigate

Try the *safest* action that restores service, even if it doesn't fix the root cause.

- Bad deploy: `helm -n prod rollback checkout-api <previous-revision> --wait --timeout 10m`.
- Bad config: revert ConfigMap via `kubectl rollout restart deploy/checkout-api` after `kubectl apply` of the previous ConfigMap.
- Bad node: `kubectl cordon` + `kubectl drain` one at a time, verifying impact each step.
- Traffic spike: scale manually `kubectl -n prod scale deploy/checkout-api --replicas=20`, raise HPA max.
- Bad dependency: flip a feature flag to fallback path, or shed traffic via rate limiter.

Confirm mitigation:
- Error rate drops below SLO threshold for 10 continuous minutes.
- p95 returns to baseline.
- No pod is `CrashLoopBackOff`.

### 7. Resolve

Slack:

```
:white_check_mark: Incident resolved 15:42 UTC
Root cause (preliminary): regression in checkout-api v1.4.2 rolled back to v1.4.1
Customer impact: ~10% of checkouts between 14:32-15:28 UTC (56 minutes)
Postmortem: scheduled, owner @alice, due 2026-04-22
```

Status page marked resolved. Page oncall off.

### 8. Postmortem

Within 24 hours, draft the postmortem using `references/postmortem-template.md`. Send for review within 72 hours. Action items land in Jira/Linear with named owners and due dates.

## Examples

### Example 1 — 5xx spike tied to a deploy

Alert: `checkout-api error rate > 2% for 5m`. Timeline shows a deploy 8 minutes earlier. Evidence: new pods log `NullPointerException` at 14:33 UTC; 30 pods restart in 5 minutes. Mitigation: `helm rollback` to previous revision. Error rate returns to baseline at 15:28 UTC. Postmortem identifies missing null check on new optional header and a staging test gap.

### Example 2 — Latency spike with no recent deploy

Alert: `p95 latency > 500ms`. No deploy in the last 24 hours. Evidence: RDS CPU at 98%, `pg_stat_activity` shows a long-running `ANALYZE` blocking queries. Mitigation: `SELECT pg_cancel_backend(pid)` for the offending session. Latency returns to baseline. Postmortem identifies a manual DBA task run during peak traffic and a missing guardrail.

## Constraints

- Never speculate publicly. Say "investigating" until you have evidence.
- Never push a forward fix during an active SEV1/SEV2 without first attempting rollback; the clock matters more than the fix.
- Never `kubectl delete pod` blindly to "clear" an issue — you lose evidence.
- Never write to production data as part of triage; read-only. Any write is a decision the IC must approve in channel.
- Never resolve the incident before metrics show sustained recovery (10 min continuous).
- Blameless means blameless. Postmortems describe systems, not individuals.
- UTC timestamps only. Local time causes reconstruction errors.

## Quality checks

- Channel has timestamped (UTC) evidence for every decision.
- Severity assignment matches impact observed (not the initial guess).
- Mitigation is confirmed by a metric, not a vibe.
- Stakeholders were updated at least every 30 min while active.
- Postmortem drafted using the template within 24 hours; action items have owners and due dates.
- All temporary silences/overrides applied during the incident are removed after resolution.
- `kubectl get events` and relevant logs captured before any pod is recreated — evidence preserved.
