# IaC Best Practices

Reference for the `iac-generator` skill. The rules below apply to Terraform primarily; the principles map directly to Bicep and Pulumi.

## State management

- **Remote backend always.** No local state for anything shared. Terraform: S3 + DynamoDB, Azure Storage + blob lease, or GCS. Pulumi: S3/Azure Blob/GCS or Pulumi Cloud. Bicep uses deployment stacks + ARM history.
- **State locking always.** S3 + DynamoDB with `LockID` PK. Storage account lease for Azure. Never run `apply` without a lock.
- **One state per environment.** `dev`, `staging`, `prod` live in separate state keys (and ideally separate backend accounts/subscriptions). Blast radius of a bad plan is contained to one env.
- **Further split by blast radius.** Networking and IAM usually change rarely and safely; application stacks change often. Split `net/`, `iam/`, `app/` into separate states. Reference across with `terraform_remote_state` or SSM Parameter Store outputs.
- **State is sensitive.** Encrypt at rest (SSE-KMS on S3, CMK on Azure Storage). Restrict read to the CI role + a break-glass human role. Never `terraform state push` from a laptop for prod.
- **Backup and versioning.** S3 bucket for state has versioning + MFA delete. Retain 180 days.

## Module structure

```
modules/
  eks-cluster/
    main.tf        # resources
    variables.tf   # inputs with types, descriptions, validation
    outputs.tf     # named outputs
    versions.tf    # required_version + required_providers
    README.md      # generated with terraform-docs
    examples/
      minimal/
      multi-az/
```

- Every input variable has `type`, `description`, and (where applicable) `validation`.
- Every output has `description` and `sensitive` set correctly.
- No provider blocks inside modules (define once at the root).
- Modules do not create providers; they consume them.
- Modules are small and composable. A module that does VPC + EKS + RDS is too big; split it.

## Naming conventions

- Resources: `${name_prefix}-${purpose}-${env}` (e.g. `acme-checkout-db-prod`).
- Terraform resource addresses: `snake_case` nouns (`aws_s3_bucket.artifacts`, not `aws_s3_bucket.this` unless there is genuinely one per module).
- Tags: `PascalCase` keys (`Env`, `Owner`, `CostCenter`, `ManagedBy`) — cloud providers tolerate any case, but pick one and enforce it.
- Avoid abbreviations except for the well-known ones (`vpc`, `db`, `kms`, `iam`). No `ckt` for `checkout`.

## Mandatory tags/labels

Every billable resource must carry:

| Tag | Example | Purpose |
|-----|---------|---------|
| `Env` | `prod` | Filtering dashboards, alerts, cost reports |
| `Owner` | `team-checkout` | Who gets paged |
| `CostCenter` | `CC-4182` | Finance allocation |
| `ManagedBy` | `terraform` | Whether manual edits are allowed |
| `Service` | `checkout-api` | Service map |
| `Repo` | `github.com/acme/checkout-api` | Where the code lives |

Enforce with an SCP / Azure Policy / GCP Org Policy so `create` fails if a mandatory tag is missing.

## Drift detection

- Schedule `terraform plan` nightly per env in CI. A non-empty plan that was not produced by a merge is drift.
- Alert to `#platform-drift` with the plan diff.
- For Azure Bicep, use deployment stacks' "deny settings" to block out-of-band changes, then use `az deployment stack validate` in CI.
- Treat drift as an incident: either the change is legitimate (codify it) or it is unauthorized (revert it).
- Use AWS Config / Azure Resource Graph / GCP Asset Inventory to catch drift for resources outside IaC coverage (manual IAM grants, tag edits).

## Policy-as-code

Run at least one of these in CI on every plan:

- **Checkov** — broad CIS/NIST coverage, fast, zero config.
- **tfsec / trivy config** — Terraform-focused security scanner.
- **OPA/Conftest** — write custom Rego for org-specific rules (e.g. "no public RDS", "all S3 buckets must have lifecycle").
- **Sentinel** (Terraform Cloud/Enterprise) — native policy framework.
- **Azure Policy / PSRule.Rules.Azure** — for Bicep/ARM.
- **Pulumi CrossGuard** — for Pulumi.

Example OPA rule preventing public RDS:

```rego
package terraform.rds

deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_db_instance"
  resource.change.after.publicly_accessible == true
  msg := sprintf("RDS instance %q must not be publicly accessible", [resource.address])
}
```

Fail the MR pipeline on `deny`. Allow exceptions only via a labeled approval from the platform team.

## CI integration

Pattern for every IaC repo:

1. **On MR open/update:**
   - `terraform fmt -check`, `terraform validate`, `tflint`.
   - `terraform plan -out plan.bin` per affected env.
   - `checkov -d .` and `conftest test plan.json`.
   - Post the plan summary and policy results as an MR comment.
2. **On MR approval + merge to main:**
   - `terraform apply plan.bin` — apply the *exact* plan that was reviewed, not a fresh one.
   - Plan artifact lives for 30 days.
3. **On schedule (nightly):**
   - `terraform plan` per env; non-empty plan pages the owner.

Never run `apply` from a laptop for prod. The CI role is the only principal with write on prod state.

## Secrets handling

- **Never in code.** Not in `.tf`, not in `.tfvars`, not in `*.bicepparam` committed to git.
- **Sources of truth:**
  - AWS: Secrets Manager, SSM Parameter Store (SecureString).
  - Azure: Key Vault (with RBAC, not access policies).
  - GCP: Secret Manager.
- **Reference, do not copy.** Terraform: `data "aws_secretsmanager_secret_version"`. Bicep: `getSecret()` via Key Vault reference. Pulumi: `pulumi_aws.secretsmanager.get_secret_version`.
- **Rotate on a schedule.** Managed rotation for RDS; custom Lambda/Function for others. Rotation breaks are better than leaks.
- **Output secrets as `sensitive = true`.** Terraform will redact in plan/apply output, but state still contains them — protect state accordingly.
- **At build time** (for CI), inject via the platform secret store (GitHub `secrets.*`, ADO variable groups, GitLab protected variables), not via repo-committed `.env`.

## Versioning and pinning

- Pin Terraform version in `required_version` (e.g. `>= 1.7, < 2.0`).
- Pin every provider in `required_providers` with `~>` at the minor level.
- Pin every module source to a tag (`?ref=v2.3.1`), never `main`.
- Run `terraform providers mirror` and commit a lockfile (`.terraform.lock.hcl`). Review lockfile changes in PRs like any other dep bump.

## Tips that save real incidents

- Use `prevent_destroy = true` on prod databases and the state bucket itself.
- For RDS, set `apply_immediately = false` by default; schedule disruptive changes in a maintenance window.
- Always create the KMS key before the resource that uses it and set an explicit `deletion_window_in_days = 30`.
- For EKS/AKS node groups, add `create_before_destroy = true` and `ignore_changes = [scaling_config[0].desired_size]` so the autoscaler doesn't fight Terraform.
- For any resource with a quota (public IPs, NAT gateways, RDS snapshots), put a CloudWatch/Azure Monitor alert at 80% usage.
