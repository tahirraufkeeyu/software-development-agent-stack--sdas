# Infrastructure Department

Platform and infrastructure teams absorb the operational blast radius of every
other team in the company. A single misconfigured ingress, an expired
certificate, or a silently-failing backup pipeline can turn into a multi-hour
outage. The work is broad (networking, observability, storage, Kubernetes,
cloud providers) and the feedback loop is long, which makes it an ideal target
for agent-assisted workflows: deterministic diagnostics, dashboard generation,
alert-rule authoring, backup posture audits, and cluster health triage can all
be driven by Claude Code from a consistent skill set.

This department packages those workflows. Every skill wraps real CLIs
(`kubectl`, `helm`, `openssl`, `dig`, `mtr`, `velero`, `cert-manager`,
`promtool`) with a deterministic procedure, explicit inputs/outputs, and
referenced templates that parse as valid YAML/JSON.

## Skills

| Skill                     | Description                                                                                                                              | Complexity |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------|------------|
| cluster-health            | Kubernetes cluster posture check: nodes, control plane, resource pressure, DaemonSets, pod lifecycle states, event triage.               | Medium     |
| network-diagnostics       | Layered connectivity triage: DNS, TCP, TLS, routing, MTU, K8s NetworkPolicy, cloud firewall / NSG rules.                                 | Medium     |
| monitoring-setup          | Install and wire kube-prometheus-stack (Prometheus + Grafana + Alertmanager), ServiceMonitors, Golden Signal dashboards, alert routing.  | High       |
| log-aggregation           | Deploy Loki + Promtail (lightweight) or ELK (heavyweight), configure retention, shipping, label hygiene, and query patterns.             | High       |
| ssl-certificate-manager   | Audit every cert in the estate, renew via cert-manager (HTTP-01 / DNS-01), enforce ≤30d warn / ≤7d critical alerts, rotate zero-downtime. | Medium     |
| backup-strategy           | 3-2-1 backup design across databases, object storage, and Kubernetes state (Velero); RPO/RTO tiering; monthly restore verification.      | High       |

## Workflow orchestrator

This department ships one **workflow orchestrator** skill that chains the task skills above into an end-to-end flow. Orchestrators have a richer frontmatter (`chains`, `produces`, `consumes`) and are invoked the same way as any other skill.

| Orchestrator | Chains | One-line purpose |
| --- | --- | --- |
| [infra-triage](skills/infra-triage/SKILL.md) | cluster-health, network-diagnostics, ssl-certificate-manager, incident-response | Structured first-response triage for ambiguous platform incidents, branching conditionally on evidence. |

## Quick install

```
./install.sh infrastructure
```

The installer copies the `skills/` tree into the active Claude Code skills
directory (`~/.claude/skills/` by default), makes scripts executable, and
prints which external CLIs (`kubectl`, `helm`, `velero`, `mtr`, `openssl`,
`dig`, `jq`, `yq`) are missing on the host.

## Recommended MCP servers

- **Kubernetes MCP** — lets Claude drive `kubectl`-equivalent calls (list
  pods, describe nodes, read events, apply manifests) without shelling out.
  Critical for `cluster-health`, `monitoring-setup`, and
  `ssl-certificate-manager`.
- **filesystem MCP** — so Claude can read generated artifacts
  (`prometheus-rules.yaml`, `grafana-dashboard.json`, `velero-schedule.yaml`,
  `backup-checklist.md`) and diff them against what is running in-cluster.
- **AWS MCP / GCP MCP / Azure MCP** (optional) — required when the estate
  includes managed services outside the cluster: RDS/Aurora snapshots, S3/GCS
  bucket lifecycle policies, Route53/Cloud DNS records, ACM/CloudDNS cert
  issuance, security groups / NSGs / firewall rules.
- **Prometheus MCP** (optional) — exposes `instant_query` and `range_query`
  tools so Claude can validate alert-rule expressions against live data before
  committing them.

## Recommended workflow

For a new cluster or a cluster you have just inherited, run the skills in this
order:

1. `cluster-health` — establish a baseline. Confirm nodes are `Ready`,
   control plane is reachable, no resource pressure, no CrashLoopBackOff pods.
   Fix blockers before continuing.
2. `network-diagnostics` — verify DNS, egress, ingress, cross-namespace
   connectivity, and NetworkPolicy coverage. Connectivity problems invalidate
   everything downstream.
3. `monitoring-setup` — install kube-prometheus-stack, wire ServiceMonitors,
   import Golden Signal dashboards, configure Alertmanager routing to Slack
   and PagerDuty. The cluster is now observable.
4. `log-aggregation` — stand up Loki + Promtail (default) or ELK, configure
   retention and label hygiene, confirm logs from every namespace land in the
   store and are queryable.
5. `ssl-certificate-manager` — audit existing certs, migrate to cert-manager
   where needed, add 30d/7d expiry alerts to the Alertmanager routes from
   step 3.
6. `backup-strategy` — classify workloads by RPO/RTO tier, schedule Velero
   backups, configure database logical + physical backups, cross-region
   replication, and the quarterly restore-test calendar.

For day-2 operations, `cluster-health` + `network-diagnostics` is the
incident-triage pair. For release gates, `monitoring-setup` verifies alert
coverage for the new service.
