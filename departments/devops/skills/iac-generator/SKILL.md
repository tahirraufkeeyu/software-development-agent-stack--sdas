---
name: iac-generator
description: Use when provisioning or modifying cloud infrastructure as code. Generates Terraform (HCL), Bicep, or Pulumi code for common resources (AKS/EKS, RDS, S3, VNet/VPC, IAM) with remote state, encryption, and least-privilege defaults.
safety: writes-local
---

## When to use

- Standing up a new environment (dev/staging/prod) from scratch.
- Adding a specific resource (cluster, database, bucket, network) to an existing stack.
- Converting click-ops resources into code after drift is detected.
- Producing a reference module that application teams can call from their own stacks.

Do not use for one-off console experimentation or for rendering architecture diagrams.

## Inputs

- `tool` — `terraform` | `bicep` | `pulumi` (Python or TypeScript).
- `cloud` — `aws` | `azure` | `gcp`.
- `resources` — list of components to generate, from:
  - Cluster: `aks`, `eks`, `gke`.
  - Database: `rds-postgres`, `azure-postgres-flexible`, `cloud-sql-postgres`.
  - Object storage: `s3`, `azure-storage`, `gcs`.
  - Network: `vpc`, `vnet` (with public/private subnets + NAT + flow logs).
  - Identity: `iam-role-least-privilege` with service-to-service bindings.
- `env` — `dev` | `staging` | `prod` (controls sizing, backup retention, deletion protection).
- `region` — primary region; optional `secondary_region` for DR.
- `name_prefix` — organization/project prefix used in naming (e.g. `acme-checkout`).
- `tags` — mandatory tags map (`Owner`, `Env`, `CostCenter`, `ManagedBy=terraform`).
- `state_backend` — details for remote state (bucket/container/lock table).

## Outputs

- Module directory layout under `infrastructure/<tool>/<env>/` with `main.tf` / `main.bicep` / `__main__.py` plus `variables`, `outputs`, and `README.md`.
- Remote state configuration (`backend.tf`, `providers.tf`, or Pulumi `Pulumi.<stack>.yaml`).
- `.checkov.yaml` / `tflint.hcl` / `psrule.yaml` policy configs.
- A `make plan` target and CI integration notes.

## Tool dependencies

- `terraform` >= 1.7, `tflint`, `checkov`, `terraform-docs`.
- `az`, `bicep` CLI >= 0.30 for Bicep; `PSRule.Rules.Azure` for policy.
- `pulumi` CLI for Pulumi; `@pulumi/policy` for policy-as-code.
- Cloud CLI for the target provider (`aws`, `az`, `gcloud`).
- `jq` for parsing plan outputs.

## Procedure

### 1. Pick the layout

```
infrastructure/
  terraform/
    modules/
      eks-cluster/
      rds-postgres/
      s3-bucket/
      vpc/
      iam-role/
    envs/
      dev/
      staging/
      prod/
```

Each env has its own `backend.tf` pointing at a different state key. Modules are versionless in-repo; publish to a registry once stable.

### 2. Configure remote state with locking

**Terraform + S3/DynamoDB:**

```hcl
terraform {
  required_version = ">= 1.7"
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "checkout/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acme-tfstate-locks"
    encrypt        = true
    kms_key_id     = "alias/tfstate"
  }
}
```

**Bicep + Azure Storage:**

Azure uses deployment stacks, not state files, but ARM-template outputs persist. Configure a storage account for artifact/what-if output:

```bash
az deployment sub create \
  --name checkout-prod-$(date +%s) \
  --location eastus \
  --template-file main.bicep \
  --parameters @prod.bicepparam
```

**Pulumi + Azure Blob backend:**

```bash
pulumi login azblob://acme-pulumi-state?storage_account=acmepulumistate
```

### 3. Generate the resource (examples)

#### VPC (Terraform, AWS)

```hcl
module "vpc" {
  source             = "../../modules/vpc"
  name               = "${var.name_prefix}-vpc"
  cidr               = "10.40.0.0/16"
  azs                = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnets     = ["10.40.0.0/20", "10.40.16.0/20", "10.40.32.0/20"]
  private_subnets    = ["10.40.64.0/20", "10.40.80.0/20", "10.40.96.0/20"]
  enable_nat_gateway = true
  single_nat_gateway = var.env != "prod"
  enable_flow_log    = true
  flow_log_destination_type = "cloud-watch-logs"
  tags               = local.tags
}
```

#### EKS cluster (Terraform)

```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name                    = "${var.name_prefix}-${var.env}"
  cluster_version                 = "1.30"
  cluster_endpoint_public_access  = false
  cluster_endpoint_private_access = true

  enable_irsa                  = true
  cluster_encryption_config    = [{ resources = ["secrets"] }]
  cluster_enabled_log_types    = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    default = {
      min_size       = var.env == "prod" ? 3 : 1
      max_size       = var.env == "prod" ? 10 : 4
      desired_size   = var.env == "prod" ? 3 : 2
      instance_types = ["m6i.large"]
      capacity_type  = var.env == "prod" ? "ON_DEMAND" : "SPOT"
      labels         = { workload = "general" }
    }
  }

  tags = local.tags
}
```

#### RDS Postgres

```hcl
module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.10"

  identifier                          = "${var.name_prefix}-${var.env}"
  engine                              = "postgres"
  engine_version                      = "16.4"
  instance_class                      = var.env == "prod" ? "db.r6g.xlarge" : "db.t4g.medium"
  allocated_storage                   = var.env == "prod" ? 200 : 50
  storage_encrypted                   = true
  kms_key_id                          = aws_kms_key.rds.arn
  multi_az                            = var.env == "prod"
  deletion_protection                 = var.env == "prod"
  iam_database_authentication_enabled = true
  publicly_accessible                 = false
  backup_retention_period             = var.env == "prod" ? 30 : 7
  performance_insights_enabled        = true

  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  manage_master_user_password = true
  master_user_secret_kms_key_id = aws_kms_key.rds.arn

  tags = local.tags
}
```

Never put a raw password in code; the `manage_master_user_password` flag stores the generated password in Secrets Manager.

#### S3 bucket with versioning + encryption

```hcl
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.name_prefix}-artifacts-${var.env}"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
```

#### IAM role (least privilege)

```hcl
data "aws_iam_policy_document" "assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:checkout:checkout-api"]
    }
  }
}

data "aws_iam_policy_document" "checkout_api" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.artifacts.arn}/checkout/*"]
  }
  statement {
    effect = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db.arn]
  }
}

resource "aws_iam_role" "checkout_api" {
  name               = "${var.name_prefix}-checkout-api-${var.env}"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "checkout_api" {
  role   = aws_iam_role.checkout_api.id
  policy = data.aws_iam_policy_document.checkout_api.json
}
```

No `Action: *`, no `Resource: *`. Scope actions to minimum set, resources to specific ARNs.

#### Bicep: AKS (private cluster)

```bicep
param location string = resourceGroup().location
param namePrefix string
param env string
var tags = { Env: env, Owner: 'platform', ManagedBy: 'bicep' }

resource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' = {
  name: '${namePrefix}-${env}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    dnsPrefix: '${namePrefix}-${env}'
    kubernetesVersion: '1.30'
    networkProfile: { networkPlugin: 'azure', networkPolicy: 'cilium', loadBalancerSku: 'standard' }
    apiServerAccessProfile: { enablePrivateCluster: true, authorizedIPRanges: [] }
    agentPoolProfiles: [ {
      name: 'system', mode: 'System'
      count: env == 'prod' ? 3 : 1
      vmSize: 'Standard_D4s_v5'
      availabilityZones: ['1', '2', '3']
    } ]
    addonProfiles: {
      azureKeyvaultSecretsProvider: { enabled: true, config: { enableSecretRotation: 'true' } }
    }
  }
  tags: tags
}
```

#### Pulumi (Python) — S3 bucket

```python
import pulumi, pulumi_aws as aws

name_prefix = pulumi.Config().require("namePrefix")
tags = {"Env": pulumi.get_stack(), "Owner": "platform", "ManagedBy": "pulumi"}

bucket = aws.s3.BucketV2(f"{name_prefix}-artifacts", tags=tags)
aws.s3.BucketVersioningV2("ver", bucket=bucket.id,
    versioning_configuration={"status": "Enabled"})
aws.s3.BucketServerSideEncryptionConfigurationV2("sse", bucket=bucket.id, rules=[{
    "apply_server_side_encryption_by_default": {"sse_algorithm": "aws:kms"},
    "bucket_key_enabled": True}])
aws.s3.BucketPublicAccessBlock("pab", bucket=bucket.id,
    block_public_acls=True, block_public_policy=True,
    ignore_public_acls=True, restrict_public_buckets=True)
```

### 4. Validate

```bash
terraform fmt -recursive
terraform init -backend=false
terraform validate
tflint --recursive
checkov -d . --framework terraform
terraform plan -out plan.bin
```

For Bicep:

```bash
bicep build main.bicep
az deployment sub what-if --location eastus --template-file main.bicep --parameters @prod.bicepparam
Invoke-PSRule -Module PSRule.Rules.Azure -InputPath .
```

### 5. CI integration

- On MR: run `fmt`, `validate`, `tflint`, `checkov`, `plan`. Post the plan as an MR comment.
- On merge to `main`: run `apply` in the target env workspace, gated by an environment approver.
- Store plan artifacts with 30-day retention for audit.

Refer to `references/iac-best-practices.md` for module structure, naming, and policy-as-code details.

## Examples

### Example 1 — Net-new EKS stack for `checkout-api` dev

Inputs: `tool=terraform`, `cloud=aws`, `resources=[vpc, eks, rds-postgres, s3, iam-role-least-privilege]`, `env=dev`, `region=us-east-1`, `name_prefix=acme-checkout`.

Generates `infrastructure/terraform/envs/dev/` with a VPC (single NAT), a single-AZ t4g RDS, a 2-node SPOT EKS group, one S3 bucket, and an IRSA role for the app. Remote state in `s3://acme-tfstate-dev` with DynamoDB locking.

### Example 2 — Azure Postgres Flexible Server in prod

Inputs: `tool=bicep`, `cloud=azure`, `resources=[azure-postgres-flexible]`, `env=prod`, `region=eastus`, `name_prefix=acme-ledger`.

Generates `infrastructure/bicep/envs/prod/postgres.bicep` with zone-redundant HA, 30-day backup retention, geo-redundant backups to `westus`, private endpoint in an existing VNet, and AAD authentication enabled. Password is generated via `@secure()` parameter and pulled from Key Vault at deploy time.

## Constraints

- Never hard-code credentials. Use `manage_master_user_password`, Key Vault references, or Secrets Manager.
- Never open a security group/NSG to `0.0.0.0/0` on administrative ports. SSH/RDP require bastion or SSM.
- Never use `*` in IAM actions or resources for application roles.
- Never disable deletion protection in prod modules.
- Never commit plaintext `.tfvars` with real values for prod. Use `-var-file` pulled from a secret store at CI time.
- Modules must be region-agnostic; parametrize every AZ/region.
- Every resource must carry the mandatory tag set.

## Quality checks

- `terraform fmt -check -recursive` passes.
- `terraform validate` passes.
- `tflint --recursive` has zero issues.
- `checkov -d .` passes with no `HIGH` or `CRITICAL` findings, and any suppressions are annotated with justification.
- `terraform plan` shows only the intended changes; no incidental diffs.
- Remote state backend is configured; `terraform init` succeeds without local state fallback.
- All outputs are documented in `README.md` (use `terraform-docs`).
- For prod: deletion protection, multi-AZ, encryption-at-rest, and backups are all `true`.
- No secrets in plan output; masked via `sensitive = true` where appropriate.
