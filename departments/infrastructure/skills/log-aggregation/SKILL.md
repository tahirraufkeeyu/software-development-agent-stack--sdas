---
name: log-aggregation
description: Use when a user wants to centralise Kubernetes logs, install Loki + Promtail or ELK (Elasticsearch + Logstash/Fluent Bit + Kibana), configure retention, wire log shipping from pods, or tune label/index hygiene. Picks the lightweight (Loki) or heavyweight (ELK) stack based on scale and budget, installs, validates ingestion, and produces a LogQL or KQL query cheat sheet.
---

## When to use

- User says "set up log aggregation", "install Loki", "we need a log stack", "ship container logs to a central place", "switch from kubectl logs to a real search UI".
- Cluster is producing logs but nothing is persisting them beyond pod lifetime.
- Existing Loki/ELK install is mis-labelled, has no retention, or is drowning in cardinality.
- User wants to correlate logs with metrics (Grafana + Loki) or run free-text search across many indices (Kibana + ES).

Do not use this skill for metrics (see `monitoring-setup`), distributed tracing (install Tempo/Jaeger separately), or on-host syslog collection outside Kubernetes.

## Inputs

- Target stack: `loki` (default; lightweight, object-store-backed) or `elk` (for heavy full-text search, existing Elastic shop, or when Kibana is a hard requirement).
- Kubeconfig context, namespace (default `logging`).
- Retention window in days (default `14d` for Loki, `30d` for ELK hot + `90d` warm).
- Object store for Loki (S3, GCS, Azure Blob) or persistent storage class and size for ELK.
- List of namespaces to ship logs from (default: all except `kube-system` unless user overrides).
- Expected ingest volume (GiB/day) — determines Loki chunk size and ES shard count.

## Outputs

- Running log stack in the target namespace with the selected components.
- DaemonSet log shipper on every node (Promtail for Loki; Fluent Bit or Filebeat for ELK).
- Retention policy enforced by the compactor (Loki) or ILM policy (Elasticsearch).
- Grafana datasource (for Loki) or Kibana index pattern (for ELK) configured.
- A query cheat sheet covering: "errors in last hour for service X", "logs for pod during incident window", "all 5xx across namespace", "trace-id correlation".
- A label/field hygiene report documenting which labels are indexed and which are not, and the estimated cardinality of each.

## Tool dependencies

- `kubectl` (≥ 1.27), `helm` (≥ 3.12), `jq`, `yq`.
- `logcli` (Loki) or `curl` + Kibana UI (ELK) for validation.
- Object store credentials (S3/GCS/Azure) for Loki; persistent volume for ELK.
- Kubernetes MCP, filesystem MCP.

## Procedure

### Choosing the stack

Pick Loki when:
- Ingest is ≤ 500 GiB/day and the primary use case is "find logs for this label set".
- Cost matters (object storage is 10-50x cheaper than ES hot storage).
- Grafana is already the UI of record.

Pick ELK when:
- Full-text search over arbitrary fields is a hard requirement.
- Security/SIEM team is already on Elastic.
- Ingest is multi-TiB/day and there is budget/ops capacity for ES cluster tuning.

### Loki + Promtail install

1. Create namespace and secrets:
   ```
   kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n logging create secret generic loki-s3 \
     --from-literal=AWS_ACCESS_KEY_ID=... \
     --from-literal=AWS_SECRET_ACCESS_KEY=...
   ```
2. Add Helm repo:
   ```
   helm repo add grafana https://grafana.github.io/helm-charts
   helm repo update
   ```
3. Write `loki-values.yaml` pinning retention and object store:
   ```yaml
   loki:
     auth_enabled: false
     schemaConfig:
       configs:
         - from: "2024-01-01"
           store: tsdb
           object_store: s3
           schema: v13
           index:
             prefix: index_
             period: 24h
     storage:
       type: s3
       bucketNames:
         chunks: loki-chunks
         ruler: loki-ruler
         admin: loki-admin
       s3:
         region: eu-west-1
     limits_config:
       retention_period: 336h   # 14d
       max_global_streams_per_user: 5000
       ingestion_rate_mb: 8
       ingestion_burst_size_mb: 16
     compactor:
       retention_enabled: true
       delete_request_store: s3
   deploymentMode: SimpleScalable
   backend:
     replicas: 2
   read:
     replicas: 2
   write:
     replicas: 3
   ```
4. Install Loki:
   ```
   helm upgrade --install loki grafana/loki --namespace logging -f loki-values.yaml --wait
   ```
5. Install Promtail (or Grafana Alloy) as a DaemonSet:
   ```
   helm upgrade --install promtail grafana/promtail --namespace logging \
     --set "config.clients[0].url=http://loki-gateway/loki/api/v1/push" --wait
   ```
6. Validate:
   ```
   logcli query --limit 5 '{namespace="default"}'
   kubectl -n logging logs ds/promtail --tail=50 | grep -i "error"
   ```
7. Register Loki as a Grafana datasource (URL: `http://loki-gateway.logging.svc:80`). Test a query from Grafana Explore: `{namespace="kube-system"} |= "error"`.

### ELK install (Elastic Operator + Filebeat)

1. Install ECK operator:
   ```
   kubectl create -f https://download.elastic.co/downloads/eck/2.14.0/crds.yaml
   kubectl apply -f https://download.elastic.co/downloads/eck/2.14.0/operator.yaml
   ```
2. Create the Elasticsearch cluster:
   ```yaml
   apiVersion: elasticsearch.k8s.elastic.co/v1
   kind: Elasticsearch
   metadata:
     name: logs
     namespace: logging
   spec:
     version: 8.13.4
     nodeSets:
       - name: master
         count: 3
         config:
           node.roles: ["master"]
         volumeClaimTemplates:
           - metadata: { name: elasticsearch-data }
             spec:
               accessModes: [ReadWriteOnce]
               storageClassName: gp3
               resources: { requests: { storage: 50Gi } }
       - name: data-hot
         count: 3
         config:
           node.roles: ["data_hot", "data_content", "ingest"]
         volumeClaimTemplates:
           - metadata: { name: elasticsearch-data }
             spec:
               accessModes: [ReadWriteOnce]
               storageClassName: gp3
               resources: { requests: { storage: 500Gi } }
   ```
3. Kibana:
   ```yaml
   apiVersion: kibana.k8s.elastic.co/v1
   kind: Kibana
   metadata:
     name: logs
     namespace: logging
   spec:
     version: 8.13.4
     count: 2
     elasticsearchRef: { name: logs }
   ```
4. Filebeat DaemonSet: use the Elastic-provided manifest from `https://raw.githubusercontent.com/elastic/beats/8.13/deploy/kubernetes/filebeat-kubernetes.yaml`. Patch `ELASTICSEARCH_HOSTS` to the `logs-es-http` service.
5. Apply an ILM policy for 30d hot + 90d warm + delete:
   ```
   PUT _ilm/policy/k8s-logs
   {
     "policy": {
       "phases": {
         "hot":   { "actions": { "rollover": { "max_age": "1d", "max_primary_shard_size": "50gb" } } },
         "warm":  { "min_age": "30d", "actions": { "shrink": { "number_of_shards": 1 }, "forcemerge": { "max_num_segments": 1 } } },
         "delete":{ "min_age": "120d", "actions": { "delete": {} } }
       }
     }
   }
   ```
6. Register the index template pointing at the `k8s-logs` ILM policy and the data stream name `logs-k8s-*`.
7. Validate:
   ```
   kubectl -n logging port-forward svc/logs-es-http 9200:9200 &
   curl -sk -u elastic:$PASS https://localhost:9200/_cat/indices?v | head
   ```

### Label and index hygiene

- Promtail: keep labels to `namespace`, `pod`, `container`, `app`, `cluster`. Never add `trace_id`, `user_id`, or `request_id` as a label — they explode cardinality. Parse them inside the log line with LogQL `| json` instead.
- Filebeat/ES: keep high-cardinality values as mapped `keyword` fields, not index dimensions. Disable `_source` enrichment for log fields you never query.
- Target: ≤ 10 active labels on Loki; ≤ 1,000 active series per tenant. Run `logcli series '{}' --analyze-labels` weekly.

## Examples

### Happy path: Loki on EKS, 80 GiB/day

Cluster: EKS 1.29, S3 bucket `acme-loki-chunks` pre-created. 12 namespaces.

Output report:

```
Stack: Loki 2.9, Promtail 2.9, deploymentMode: SimpleScalable
Retention: 14d (336h)
Ingesters: write=3, read=2, backend=2
Promtail pods: 6 (one per node)
Active streams: 412
Grafana datasource: http://loki-gateway.logging.svc:80
Cheat sheet:
  {namespace="payments", app="api"} |= "ERROR" | json | line_format "{{.msg}}"
  rate({namespace="payments"}[5m])
  {namespace=~".+"} |~ "trace_id=abc123"
```

### Edge case: ELK replacing a legacy Fluentd + ES stack

A 2020-era Fluentd DaemonSet is shipping to a self-managed ES 6.8. Approach:

1. Stand up new ECK cluster (8.13) alongside the old one.
2. Dual-write for 7 days: leave Fluentd shipping to old ES, add Filebeat shipping to new ES. Compare volumes daily.
3. Cut Kibana UI to the new cluster; keep the old cluster read-only for 30 days.
4. Decommission Fluentd and old ES once the grace window expires and a restore test has succeeded against a frozen snapshot.

Never hot-migrate indices across major ES versions; always dual-write and cut.

## Constraints

- Never ship logs without retention configured; storage growth is unbounded and incidents become archaeology.
- Never promote trace IDs, user IDs, request IDs, or any per-request value to a Loki label or an ES index dimension.
- Never run ES with `heap >= 32 GiB`; compressed oops cutoff kills performance. Keep heap at 50% of pod memory, capped at 31 GiB.
- Never store credentials (DB passwords, tokens) in logs. If detected in the pipeline, drop-filter at the shipper, then fix the application.
- Always TLS-terminate Kibana and Loki gateway in-cluster; do not expose plaintext.
- Always run a retention dry-run before enabling the compactor in production (`-compactor.retention-delete-delay=72h`).

## Quality checks

- A query for the previous 5 minutes from a known-noisy namespace returns results within 2 seconds.
- Promtail/Filebeat pods report `0` parse errors in the last hour (`rate(promtail_dropped_entries_total[1h]) == 0`).
- Active label/series cardinality is within the documented budget (Loki ≤ 10 labels, ES ≤ 1 k active shards per node).
- Retention policy is active: for Loki, `loki_compactor_deleted_chunks_total` is incrementing; for ES, ILM transitions visible in `GET _ilm/status`.
- Grafana Explore (Loki) or Kibana Discover (ELK) loads a sample query end-to-end.
- Sensitive-data scan on a 1 h sample returns zero credential hits (grep for `password=`, `authorization:`, `aws_secret`).
- The cheat-sheet queries in the output all execute successfully.
