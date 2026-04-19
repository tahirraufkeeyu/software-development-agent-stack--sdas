---
name: backup-strategy
description: Use when a user wants to design or audit a backup posture across databases, object storage, and Kubernetes state; targets 3-2-1 (3 copies, 2 media, 1 offsite); sets RPO/RTO per workload tier; schedules Velero for K8s state and logical + physical backups for databases; enforces monthly restore tests. Produces a backup inventory, schedules, and a restore-test calendar.
safety: writes-shared
---

## When to use

- User says "we need backups", "audit our backups", "set up Velero", "our RDS snapshots aren't tested", "what's our RTO", or describes a ransomware / accidental-delete scare.
- A new data-bearing workload is being introduced (new Postgres, new bucket).
- SOC 2 / ISO 27001 evidence required for the backup control.
- A restore has never been tested in anger.
- A workload's RPO/RTO is unknown or out of date.

Do not use this skill for log retention (see `log-aggregation`), for metrics retention (see `monitoring-setup`), or for source-code backups (that is what your Git host and a periodic repo mirror cover).

## Inputs

- Inventory of data-bearing systems: databases (engine, version, size), buckets (S3/GCS/Azure, size), K8s clusters (namespaces with persistent state), managed services (ElastiCache, MSK, etc.).
- Business tiering: which workloads are Tier 1 (customer-facing, payments), Tier 2 (internal critical), Tier 3 (nice-to-have).
- Target RPO / RTO per tier (defaults below).
- Regulatory constraints: data residency, retention minimums, encryption-at-rest requirements.
- Offsite destination (cross-region bucket, different cloud, or physical tape vault).

Default tiering (override with user input):

| Tier | Example workloads            | RPO   | RTO    | Frequency                         | Retention    |
|------|------------------------------|-------|--------|-----------------------------------|--------------|
| 1    | prod DB, payment bucket      | 5 min | 1 h    | Continuous WAL + 15-min snapshots | 30d + 7y PIT |
| 2    | prod K8s state, internal DBs | 1 h   | 4 h    | Hourly snapshots                  | 30d          |
| 3    | dev, stage, analytics        | 24 h  | 24 h   | Daily                             | 14d          |

## Outputs

- Backup inventory table with: `workload | tier | RPO | RTO | method | destination | encryption | schedule | retention | last restore test`.
- Scheduled jobs / resources:
  - Velero `Schedule` resources for each K8s namespace group.
  - RDS / Aurora automated backups and cross-region snapshot copy.
  - Postgres `pgBackRest` or `wal-g` config for self-managed instances (logical `pg_dump` nightly + physical continuous WAL).
  - Bucket replication rules (S3 Cross-Region Replication, GCS dual-region, or Azure GRS).
- Encryption posture per backup: KMS key ID, algorithm, rotation cadence.
- Access policy: who can read backups, who can delete, object-lock / MFA-delete setup.
- A restore-test calendar: monthly sample restore, quarterly full restore per tier.
- The checklist from [references/backup-checklist.md](references/backup-checklist.md), filled in.

## Tool dependencies

- `kubectl`, `helm`.
- `velero` CLI (≥ 1.14) for K8s state.
- `aws` / `gcloud` / `az` CLIs for managed services.
- `pgbackrest`, `wal-g`, `pg_dump`, `mysqldump`, `mongodump` for self-managed databases.
- `restic` or `kopia` for filesystem backups outside K8s.
- Kubernetes MCP, filesystem MCP, cloud provider MCPs for scheduling and audit.

## Procedure

1. Inventory and classify. List every data-bearing system with owner, size, tier, current backup state (or "none"). Use a spreadsheet-like table — this is the single source of truth.

2. Apply the 3-2-1 rule per workload.
   - 3 copies: the live system + 2 backup copies.
   - 2 media: on-site (same region) + off-site (different region or cloud).
   - 1 offsite: immutable, ideally in a different trust domain (separate AWS account, different cloud).
   - Immutability: S3 Object Lock (Compliance mode), GCS Bucket Lock, Azure Immutable Blob Storage. A ransomware event must not be able to delete or overwrite backups.

3. Databases — logical + physical.

   Managed (RDS, Aurora, Cloud SQL):
   ```
   aws rds modify-db-instance --db-instance-identifier prod-pg \
     --backup-retention-period 35 \
     --preferred-backup-window "03:00-04:00" --apply-immediately
   aws rds start-export-task --export-task-identifier weekly-prod-pg-$(date +%F) \
     --source-arn arn:aws:rds:eu-west-1:...:snapshot:rds:prod-pg-YYYY-MM-DD \
     --s3-bucket-name acme-db-exports --iam-role-arn arn:aws:iam::...:role/rds-export \
     --kms-key-id alias/db-backups
   ```
   Configure cross-region automated backups (Aurora Global, RDS cross-region copy) and confirm target-region snapshots exist.

   Self-managed Postgres: `pgBackRest` is the default.
   ```ini
   # /etc/pgbackrest/pgbackrest.conf
   [global]
   repo1-path=/var/lib/pgbackrest
   repo1-retention-full=4
   repo1-retention-diff=7
   repo1-s3-bucket=acme-pg-backups
   repo1-s3-endpoint=s3.eu-west-1.amazonaws.com
   repo1-s3-region=eu-west-1
   repo1-cipher-type=aes-256-cbc
   repo1-type=s3
   start-fast=y
   archive-async=y

   [prod]
   pg1-path=/var/lib/postgresql/15/main
   ```
   Schedule: full weekly Sunday 02:00, differential daily, incremental every 15 min. Enable WAL archiving for PITR.

   Add a logical nightly `pg_dump -Fc` to the same bucket for easy single-table restore.

4. Object storage — replication + versioning + lifecycle.
   ```
   aws s3api put-bucket-versioning --bucket acme-prod-data --versioning-configuration Status=Enabled
   aws s3api put-object-lock-configuration --bucket acme-prod-backups --object-lock-configuration '{
     "ObjectLockEnabled": "Enabled",
     "Rule": { "DefaultRetention": { "Mode": "COMPLIANCE", "Days": 35 }}
   }'
   aws s3api put-bucket-replication --bucket acme-prod-data --replication-configuration file://repl.json
   aws s3api put-bucket-lifecycle-configuration --bucket acme-prod-data --lifecycle-configuration file://lifecycle.json
   ```
   Lifecycle: current version 90d → Glacier IR, noncurrent 30d → Glacier, 7y → delete (or per regulatory).

5. Kubernetes state — Velero.
   ```
   velero install \
     --provider aws \
     --plugins velero/velero-plugin-for-aws:v1.10.0 \
     --bucket acme-velero --prefix prod-cluster \
     --backup-location-config region=eu-west-1 \
     --snapshot-location-config region=eu-west-1 \
     --secret-file ./credentials-velero \
     --use-node-agent --uploader-type=kopia --default-volumes-to-fs-backup
   ```
   Schedules:
   ```yaml
   apiVersion: velero.io/v1
   kind: Schedule
   metadata:
     name: tier1-hourly
     namespace: velero
   spec:
     schedule: "0 * * * *"
     template:
       includedNamespaces: [payments, checkout]
       ttl: 720h0m0s
       storageLocation: default
       defaultVolumesToFsBackup: true
   ---
   apiVersion: velero.io/v1
   kind: Schedule
   metadata:
     name: cluster-daily
     namespace: velero
   spec:
     schedule: "0 2 * * *"
     template:
       includedNamespaces: ["*"]
       excludedNamespaces: [kube-system, velero]
       ttl: 336h0m0s
   ```
   Configure a second BackupStorageLocation in a different region (read-only primary for DR, writable for the mirror).

6. Encryption and access.
   - All backups encrypted at rest with a KMS key scoped to the backup account.
   - Key rotation annual, with an audit log of rotations.
   - IAM: write-only role for backup producers; read + restore role reserved for break-glass; object-lock prevents delete by anyone.

7. Restore-test calendar.
   - Monthly: pick one random Tier 1 workload; restore a single table / object / namespace to a scratch target; verify row count / object hash / pod Ready. 60-minute time-box.
   - Quarterly: full restore of one Tier 1 workload end-to-end to a parallel environment; measure RTO; compare to target.
   - Annually: regional-failure tabletop. Delete access to the primary region (simulated) and rehearse the DR runbook.
   - Record every test in the inventory `last restore test` column and in a ticket with screenshots and timings.

8. Populate the checklist at [references/backup-checklist.md](references/backup-checklist.md) for every workload and attach to the ticket.

9. Alert on backup failures. Export Velero metrics (`velero_backup_failure_total`) and RDS/Aurora snapshot events to the Alertmanager / Prometheus stack from `monitoring-setup`. Missed schedule (`velero_backup_last_successful_timestamp` older than `2 * schedule interval`) is `critical`.

## Examples

### Happy path: mid-size SaaS, EKS + Aurora + S3

Inventory: 1 Aurora Postgres (120 GiB), 2 S3 buckets (2 TiB user uploads), EKS with 12 namespaces, 6 of them stateful.

Plan produced:

```
Aurora:   Tier 1, RPO 5m, RTO 1h. Automated backups 35d, PITR, cross-region replica.
Uploads:  Tier 1, RPO 5m, RTO 1h. Versioning + CRR to eu-central-1 + Object Lock 35d.
Internal: Tier 2, RPO 1h, RTO 4h. Velero hourly + daily cluster backup, 30d retention.
Dev:      Tier 3, RPO 24h, RTO 24h. Velero daily, 14d retention, no CRR.

Restore test calendar: monthly sample (1st Tue), quarterly full (first month of Q).
Next test: 2026-05-05 — restore `orders` table from last night's Aurora export to a scratch instance; target <15 min.
```

### Edge case: on-prem MySQL with no ops team

A single on-prem MySQL primary, no DBA, no offsite backup. Owner wants "something that works".

Plan:

1. Install `mysqldump` nightly + `xtrabackup` weekly full.
2. Encrypt with `age`, upload to S3 in a separate AWS account with Object Lock (Compliance mode, 35d).
3. Classify as Tier 2 initially (RPO 24h) with a roadmap to Tier 1 once binlog streaming is added.
4. Monthly restore to a container on any spare host; target <2 hours.
5. Document the runbook; the owner rehearses the restore once.

Never leave a production DB with only local backups; a disk failure is a total loss.

## Constraints

- Never store backups in the same cloud account / project as the source. A compromised root credential must not be able to delete them.
- Never consider a backup valid until it has been restored successfully. "Backups succeeded" is not "backups work".
- Never skip encryption at rest. Every backup object has a KMS-encrypted envelope.
- Never put secrets (DB passwords, TLS private keys) in a backup intended for a less-trusted destination without re-wrapping.
- Never let Object Lock retention exceed the regulatory maximum; over-retention is a privacy risk for personal data.
- Never use "continuous" replication (RDS read replica, S3 CRR alone) as the only backup; it propagates logical errors. Point-in-time, immutable backups must exist separately.
- Always test restore before decommissioning the old backup system.

## Quality checks

- Every Tier 1 workload has a successful restore recorded in the last 30 days.
- Every Tier 2 workload has a successful restore recorded in the last 90 days.
- 3-2-1 is satisfied for every Tier 1 and Tier 2 workload (verified from the inventory table).
- Object Lock / WORM is enabled on the offsite copy for Tier 1.
- Velero `velero backup get` shows `Completed` for the last run of every Schedule.
- `velero_backup_last_successful_timestamp` gap is under 2x the schedule for every Schedule.
- RDS automated backup retention ≥ 7 days for prod.
- The restore-test calendar is populated 12 months ahead, with owners assigned.
- The checklist in `references/backup-checklist.md` is filled for every workload.
