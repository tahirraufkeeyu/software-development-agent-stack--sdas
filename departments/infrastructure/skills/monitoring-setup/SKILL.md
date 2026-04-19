---
name: monitoring-setup
description: Use when a user wants to provision Kubernetes observability, install Prometheus/Grafana/Alertmanager, wire ServiceMonitors, import Golden Signal dashboards, or configure alert routing to Slack/PagerDuty. Installs kube-prometheus-stack via Helm, applies ServiceMonitors, loads dashboards for latency/traffic/errors/saturation, and commits Alertmanager routes.
safety: writes-shared
---

## When to use

- User says "set up monitoring", "install Prometheus", "add Grafana dashboards", "wire Alertmanager to Slack", or "we need alerts for CPU/memory/error rate".
- A new cluster has no metrics backend and services are emitting `/metrics` endpoints that nothing is scraping.
- Existing Prometheus is present but ServiceMonitors are missing for a specific workload.
- User wants Golden Signal coverage (latency, traffic, errors, saturation) on an existing service.

Do not use this skill for log aggregation (use `log-aggregation`), for tracing (out of scope — install Tempo/Jaeger separately), or for synthetic monitoring (use blackbox-exporter which this skill can point at).

## Inputs

- Kubeconfig context for the target cluster (`kubectl config current-context`).
- Target namespace (default `monitoring`).
- Helm chart version of `kube-prometheus-stack` (default: pin to a known-good release, e.g. `55.5.0`+).
- Notification targets: Slack webhook URL (per severity channel) and/or PagerDuty integration key.
- List of services to cover with ServiceMonitors (namespace, label selector, port name, metrics path).
- Storage class for Prometheus PVC and retention window (default `30d`).

## Outputs

- Running `kube-prometheus-stack` release in the target namespace with Prometheus, Grafana, Alertmanager, node-exporter, kube-state-metrics, Prometheus Operator.
- `ServiceMonitor` resources for every listed service.
- `PrometheusRule` with the baseline alerts from [references/alertmanager-rules-template.yaml](references/alertmanager-rules-template.yaml).
- Grafana dashboards imported from [references/grafana-dashboard-templates.json](references/grafana-dashboard-templates.json), plus the community dashboards for kubelet (1860), node-exporter (1860), and kube-state-metrics (13332).
- Alertmanager configuration with per-severity routing (`critical` → PagerDuty + Slack, `warning` → Slack only, `info` → swallowed).
- A verification report: `prom-rules.yaml` lint result, list of up targets, a test alert firing end-to-end.

## Tool dependencies

- `kubectl` (≥ 1.27), `helm` (≥ 3.12), `jq`, `yq`, `curl`.
- `promtool` for `check rules`.
- Kubernetes MCP for list/apply operations if available.
- `amtool` for Alertmanager config validation.

## Procedure

1. Preflight. Run `kubectl get nodes`, `kubectl version --short`, and confirm the cluster has at least 4 vCPU and 8 GiB of free capacity. Check that no other Prometheus Operator is installed: `kubectl get crd | grep monitoring.coreos.com`. If it is, either reuse it or uninstall the old operator first.
2. Add the Helm repo and create the namespace:
   ```
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update
   kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
   ```
3. Render a values file `kps-values.yaml` that pins retention, storage, scrape interval, and routing. Key stanzas:
   ```yaml
   prometheus:
     prometheusSpec:
       retention: 30d
       scrapeInterval: 30s
       evaluationInterval: 30s
       storageSpec:
         volumeClaimTemplate:
           spec:
             storageClassName: gp3
             resources:
               requests:
                 storage: 100Gi
       serviceMonitorSelectorNilUsesHelmValues: false
       ruleSelectorNilUsesHelmValues: false
   grafana:
     adminPassword: "__replace_me__"
     defaultDashboardsEnabled: true
     persistence:
       enabled: true
       size: 10Gi
   alertmanager:
     config:
       route:
         receiver: slack-warnings
         group_by: ["alertname", "namespace", "severity"]
         group_wait: 30s
         group_interval: 5m
         repeat_interval: 4h
         routes:
           - receiver: pagerduty-critical
             matchers: ['severity="critical"']
             continue: true
           - receiver: slack-critical
             matchers: ['severity="critical"']
           - receiver: slack-warnings
             matchers: ['severity="warning"']
           - receiver: "null"
             matchers: ['severity="info"']
       receivers:
         - name: "null"
         - name: slack-warnings
           slack_configs:
             - api_url: "__SLACK_WARN_WEBHOOK__"
               channel: "#alerts-warn"
               send_resolved: true
               title: '{{ template "slack.default.title" . }}'
               text: '{{ template "slack.default.text" . }}'
         - name: slack-critical
           slack_configs:
             - api_url: "__SLACK_CRIT_WEBHOOK__"
               channel: "#alerts-critical"
               send_resolved: true
         - name: pagerduty-critical
           pagerduty_configs:
             - routing_key: "__PAGERDUTY_KEY__"
               severity: critical
               send_resolved: true
   ```
   Replace the three placeholder tokens with real secrets from a sealed-secret, External Secrets Operator, or `kubectl create secret`.
4. Install or upgrade:
   ```
   helm upgrade --install kps prometheus-community/kube-prometheus-stack \
     --namespace monitoring --version 55.5.0 -f kps-values.yaml --wait --timeout 15m
   ```
5. Validate the install:
   ```
   kubectl -n monitoring get pods
   kubectl -n monitoring get servicemonitors
   kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090 &
   curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
   ```
6. Apply baseline alerts. Copy [references/alertmanager-rules-template.yaml](references/alertmanager-rules-template.yaml), substitute the namespace label if required, validate with `promtool check rules` (after extracting the `spec.groups` with `yq`), then `kubectl apply -f`.
7. Write ServiceMonitors for each input service. Template:
   ```yaml
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: <app>-sm
     namespace: monitoring
     labels:
       release: kps
   spec:
     namespaceSelector:
       matchNames: ["<app-ns>"]
     selector:
       matchLabels:
         app.kubernetes.io/name: <app>
     endpoints:
       - port: <metrics-port-name>
         path: /metrics
         interval: 30s
         scrapeTimeout: 10s
   ```
   Confirm `up{job="<app>-sm"} == 1` in Prometheus.
8. Import dashboards. From Grafana UI or via ConfigMap with label `grafana_dashboard: "1"`, apply [references/grafana-dashboard-templates.json](references/grafana-dashboard-templates.json). Also import community dashboards: `1860` (node-exporter), `13332` (kube-state-metrics), `7249` (kubelet), `15661` (Kubernetes overview).
9. Fire a synthetic alert end-to-end:
   ```
   kubectl -n monitoring run stress --image=polinux/stress --restart=Never -- \
     stress --cpu 4 --timeout 600s
   ```
   Watch `#alerts-warn` for the `HighCPU` notification. Remove the pod afterward.
10. Document. Emit a short report listing the Helm release name, chart version, active targets count, firing alerts count, dashboards imported, and the Alertmanager receivers configured. Store the values file and secrets source in the ops repo.

## Examples

### Happy path: greenfield cluster, 2 services, Slack + PagerDuty

Inputs: cluster `prod-eu`, namespace `monitoring`, services `api` in namespace `default` (port `http-metrics`), `worker` in `jobs` (port `metrics`), Slack `#alerts-warn` + `#alerts-crit`, PagerDuty key for the SRE service.

Steps executed:

1. `helm install kps ... --version 55.5.0`.
2. Two ServiceMonitors applied, both show `up == 1`.
3. `PrometheusRule` `baseline-alerts` applied from the template.
4. Grafana dashboard `Golden Signals` imported; loads with data within 2 minutes.
5. Stress pod triggers `HighCPU` → Slack `#alerts-warn` at severity `warning`; `HighErrorRate` simulated via fault injection triggers PagerDuty incident. Resolve paths confirmed.

Report delivered to the user:

```
kps 55.5.0 installed in monitoring
Active scrape targets: 42
Firing alerts: 0
Dashboards imported: 4 (Golden Signals, node-exporter, kube-state-metrics, kubelet)
Alertmanager receivers: slack-warnings, slack-critical, pagerduty-critical, null
```

### Edge case: existing Prometheus Operator, no persistent storage

The cluster has a prior `prometheus-operator` install from 2019 and no default StorageClass. Approach:

1. Detect with `kubectl get crd prometheuses.monitoring.coreos.com -o yaml | yq '.metadata.labels'`. Old install has no `app.kubernetes.io/managed-by: Helm`.
2. Refuse to overwrite. Offer two paths: (a) adopt the existing CRDs by installing chart with `crds.enabled=false` and matching selector labels; (b) uninstall the legacy operator after exporting its alert rules with `kubectl get prometheusrules -A -o yaml > legacy-rules.yaml`.
3. For storage: if no StorageClass, set `prometheus.prometheusSpec.storageSpec: {}` for emptyDir (with an explicit warning that data is lost on pod restart), or create a StorageClass first. Never silently accept data loss.

## Constraints

- Never commit real Slack webhooks or PagerDuty keys to git. Use sealed-secrets, External Secrets, or `kubectl create secret` referenced from the Helm values.
- Never set Grafana admin password to a default in production. Generate with `openssl rand -base64 24`.
- Never set `scrapeInterval` below `15s` without a documented reason; it 2x's storage cost.
- Never disable `ruleSelectorNilUsesHelmValues: false` once set — other teams' `PrometheusRule` resources will stop being discovered.
- Never route `severity=info` to a human channel; it desensitises responders.
- Always pin the Helm chart version. `latest` breaks reproducibility.
- Always set retention and storage explicitly. Defaults are rarely right for production.

## Quality checks

- `kubectl -n monitoring get pods` shows every pod `Running` and `Ready`.
- `curl -s localhost:9090/api/v1/targets | jq '[.data.activeTargets[] | select(.health!="up")] | length'` returns `0`.
- `promtool check rules baseline-alerts.yaml` exits 0.
- `amtool check-config alertmanager.yaml` exits 0.
- At least one synthetic alert has fired end-to-end (Prometheus → Alertmanager → Slack/PagerDuty) and been marked resolved.
- Grafana dashboard `Golden Signals` renders with non-empty panels for the target service within 5 minutes of first scrape.
- Alertmanager routing tree has an explicit `severity=info` → `null` branch.
- All four Golden Signals (latency, traffic, errors, saturation) are present on the primary dashboard.
