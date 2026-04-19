---
name: cost-optimizer
description: Use when quarterly cloud bills need review or a cost-cut mandate lands. Ingests AWS Cost Explorer exports, Azure Cost Management data, or GCP Billing exports and returns a ranked list of idle resources, over-provisioned instances, unused reservations, and data-transfer waste with estimated monthly savings.
---

## When to use

- Quarterly finance review of cloud spend.
- Finance flags a month-over-month jump and the owner is unknown.
- Before renewing a reserved capacity commitment, to validate the shape is right.
- After a significant architecture change, to confirm expected savings materialized.

Do not use for real-time cost alerting; that's a budget alarm, not this skill.

## Inputs

- `cloud` — `aws` | `azure` | `gcp`.
- `billing_export` — path or URL to the billing export:
  - AWS: Cost and Usage Report (CUR) in S3 (Parquet preferred).
  - Azure: Cost Management export in storage (CSV/Parquet).
  - GCP: BigQuery billing export dataset.
- `window` — analysis window, typically last 30 or 90 days.
- `account_filter` — optional list of account IDs / subscription IDs / project IDs.
- `tag_filter` — optional filters (e.g. `Env=prod`, `Owner=team-checkout`).
- `min_savings_usd` — threshold below which recommendations are skipped (default $50/mo).
- `utilization_source` — where to pull CPU/memory/network: CloudWatch, Azure Monitor, GCP Cloud Monitoring, or Prometheus.

## Outputs

- A Markdown report with:
  - Top-line spend and trend.
  - Breakdown by service, env, and owner (when tags allow).
  - Ranked recommendations table: resource, action, current $/mo, projected $/mo, effort.
  - Quick-win section (anything recoverable within a day).
  - Structural section (anything requiring refactor/capacity planning).
- A CSV `recommendations.csv` for import into a ticketing system.
- Optional: draft Jira/Linear tickets per recommendation.

## Tool dependencies

- AWS: `aws` CLI + Athena (or DuckDB over the CUR), `aws ce` for quick queries.
- Azure: `az` CLI + Cost Management REST API, Azure Advisor REST API.
- GCP: `gcloud` + BigQuery CLI, Recommender API.
- `duckdb` for local analysis of Parquet/CSV exports.
- `jq`, `csvkit` for post-processing.

## Procedure

### 1. Snapshot current spend

**AWS (Cost Explorer + CUR):**

```bash
# Top-level trend
aws ce get-cost-and-usage \
  --time-period Start=2026-01-19,End=2026-04-19 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table

# CUR in Athena
athena-cli -d cur -q "
SELECT line_item_product_code, SUM(line_item_unblended_cost) AS cost
FROM cur.cur
WHERE line_item_usage_start_date >= DATE '2026-01-19'
GROUP BY 1 ORDER BY cost DESC LIMIT 20;"
```

**Azure:**

```bash
az costmanagement query \
  --type ActualCost \
  --timeframe TheLastMonth \
  --dataset-granularity Daily \
  --dataset-aggregation '{"totalCost":{"name":"Cost","function":"Sum"}}' \
  --dataset-grouping '[{"type":"Dimension","name":"ServiceName"}]' \
  --scope "/subscriptions/$SUB"
```

**GCP:**

```sql
SELECT service.description, SUM(cost) AS cost
FROM `proj.billing.gcp_billing_export_v1_XXXX`
WHERE usage_start_time BETWEEN TIMESTAMP('2026-01-19') AND TIMESTAMP('2026-04-19')
GROUP BY 1 ORDER BY cost DESC LIMIT 20;
```

### 2. Enumerate candidate waste

Run each category in parallel. Only keep candidates exceeding `min_savings_usd`.

#### Idle resources

- **EC2/VM** — average CPU < 5% and network < 1MB/s for 14 consecutive days.
- **RDS/Azure SQL** — `DatabaseConnections == 0` for 7 days, or CPU < 2%.
- **EBS/Managed Disks** — unattached (`State=available`) for > 7 days.
- **Elastic IPs / Public IPs** — not associated with a running resource.
- **Load balancers** — zero request count for 7 days.
- **NAT Gateways** — in an AZ with no running workload.
- **Snapshots** — older than 90 days with no restore, not tagged `retain`.
- **S3/Storage** — buckets with no access in last 60 days (access logs / storage analytics).

AWS example (unattached EBS):

```bash
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[?CreateTime<=`2026-04-12`].{ID:VolumeId,Size:Size,AZ:AvailabilityZone,Tags:Tags}' \
  --output table
```

Cost estimate: EBS gp3 at $0.08/GB-month -> `size_gb * 0.08`.

#### Over-provisioned

- **EC2/VM** — p95 CPU < 40% and p95 memory < 50% over 14 days -> propose the next smaller size.
- **RDS/Azure SQL** — p95 CPU < 30% and peak connections < 40% of max -> propose tier down.
- **EKS/AKS node groups** — average node utilization < 40% -> propose smaller node SKU or fewer nodes.
- **Kubernetes pods** — `requests.cpu` consistently > 4x p95 usage (Vertical Pod Autoscaler recommendation or `kube-resource-report`).

Use CloudWatch / Azure Monitor / Cloud Monitoring metrics to get p95, not averages.

```bash
# AWS CloudWatch p95 CPU over 14 days
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0abc \
  --start-time 2026-04-05T00:00:00Z --end-time 2026-04-19T00:00:00Z \
  --period 3600 --extended-statistics p95
```

#### Unused reserved capacity / commitments

- **AWS** — `aws ce get-reservation-utilization` -> any RI/SP with utilization < 80% is a candidate to modify or sell (standard RIs can be sold on Marketplace).
- **Azure** — Azure Advisor's `Reservations` category + manual review of reservation usage reports.
- **GCP** — CUD utilization from `gcloud compute commitments list` cross-referenced with actual usage.

Also look for *missing* commitments: on-demand spend patterns that have been stable for 90+ days with no coverage are candidates for new commitments.

#### Data transfer

- **Cross-AZ traffic** — chatty services split across AZs. Look at `DataTransfer-Regional-Bytes` line items.
- **NAT gateway egress** — services chatting to S3 without a VPC endpoint burn NAT costs.
- **Inter-region replication** — S3 CRR / GCS multi-region / Azure GRS: verify you actually need cross-region.
- **Egress to internet** — often the largest line item; check for misconfigured image pulls (pulling from public registries instead of in-region mirrors).

CUR query:

```sql
SELECT line_item_usage_type, SUM(line_item_unblended_cost) AS cost
FROM cur.cur
WHERE line_item_usage_type LIKE '%DataTransfer%'
  AND line_item_usage_start_date >= DATE '2026-03-19'
GROUP BY 1 ORDER BY cost DESC LIMIT 20;
```

### 3. Pull platform-native recommendations

These services do a lot of the math already; merge their output with your analysis.

```bash
# AWS
aws compute-optimizer get-ec2-instance-recommendations
aws trustedadvisor describe-checks --language en | jq -r '.checks[] | select(.category=="cost_optimizing") | .id' \
  | xargs -I{} aws trustedadvisor describe-check-result --check-id {}

# Azure
az advisor recommendation list --category Cost -o table

# GCP
gcloud recommender recommendations list \
  --project=$PROJ --location=global \
  --recommender=google.compute.instance.MachineTypeRecommender
```

### 4. Rank and quantify

For each candidate:

- Compute projected monthly savings (`current - projected`). Use the on-demand public price for the target SKU, not the current RI-adjusted price.
- Score effort: `low` (delete / resize in place), `medium` (requires change window or code change), `high` (architectural refactor).
- Assign owner via tags (`Owner` tag) — if missing, flag as "unowned" and escalate separately.

Output table:

| Rank | Resource | Action | $/mo now | $/mo after | Savings | Effort | Owner |
|------|----------|--------|----------|------------|---------|--------|-------|
| 1 | `nat-0abc` (us-east-1c) | Consolidate to single-AZ NAT | 96 | 32 | 64 | low | platform |
| 2 | `db-reporting-prod` | Downsize r6i.2xlarge -> r6i.xlarge | 425 | 213 | 212 | medium | data |
| 3 | 42 unattached EBS vols | Delete after 30-day snapshot | 287 | 0 | 287 | low | unowned |

### 5. Produce outputs

- Write the Markdown report to `reports/cost-<YYYY-MM>.md`.
- Write `recommendations.csv` with columns: `rank,resource_id,service,action,monthly_savings,effort,owner,ticket_url`.
- If a ticketing MCP is connected, offer to open one ticket per recommendation with owner and due date.

### 6. Close the loop

- Tag each recommendation after action with: `accepted`, `deferred (reason)`, or `rejected (reason)`.
- On next quarterly run, compare against last quarter's accepted recs; flag any that did not materialize savings.
- Track realized savings against forecasted savings per quarter.

## Examples

### Example 1 — AWS prod account review

Inputs: `cloud=aws`, CUR in `s3://acme-cur-prod/`, `window=90d`, `min_savings_usd=100`.

Produces a report with: top-line $142k/mo, top 5 services (EC2, RDS, NAT, S3, DataTransfer), 23 recommendations totaling $18.6k/mo projected savings. Quick-wins (~$4.1k/mo): 42 unattached EBS volumes, 7 idle EIPs, 3 idle LBs, single-AZ NAT consolidation in dev. Structural (~$14.5k/mo): rightsizing 11 RDS instances, converting 60% of the flat EC2 baseline into Compute Savings Plan.

### Example 2 — Azure subscription with missing tags

Inputs: `cloud=azure`, Cost Management export, `tag_filter=none`, `min_savings_usd=50`.

First pass: 38% of spend is on resources without an `Owner` tag. Output prioritizes a tagging action item before savings work — you can't rightsize what you can't attribute. Second-pass recommendations follow the same table format; the unowned block is surfaced to the platform team.

## Constraints

- Never delete a resource directly; always produce a recommendation + ticket.
- Never trust a single 24-hour window for utilization; use 14 days minimum.
- Never propose "just turn it off" for shared infra without a migration plan.
- Don't double-count RI/SP discounts: compare on-demand list price to on-demand list price when estimating savings.
- Don't flag test accounts for deep analysis; they are inherently bursty.
- Respect data-residency constraints when proposing region moves.
- Estimated savings are estimates; state the assumptions (utilization period, SKU price, commitment type).

## Quality checks

- Every recommendation has: resource ID, current cost, projected cost, effort, owner.
- Every current/projected cost uses the same pricing source (public on-demand unless stated).
- Utilization metrics span at least 14 days; p95 stated, not average.
- Platform-native recommendations (Compute Optimizer / Advisor / Recommender) are cross-checked — not just rubber-stamped.
- The report calls out any tag-coverage gaps that blocked owner attribution.
- Totals in the report match the sum of the recommendations CSV.
- Realized savings are measured next quarter against projected and reported back.
