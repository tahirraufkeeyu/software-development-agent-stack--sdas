# Backup Checklist (per workload)

Fill one copy of this checklist for every data-bearing workload. Store the
completed checklist alongside the workload's runbook.

## 1. Workload identification

- [ ] Workload name and owner (team + on-call rotation):
- [ ] System type (managed DB / self-managed DB / bucket / K8s PVC / other):
- [ ] Current size (GiB) and growth rate (GiB/month):
- [ ] Business tier (1 / 2 / 3):
- [ ] Data classification (public / internal / confidential / regulated):
- [ ] Regulatory regime (GDPR / HIPAA / PCI / SOC 2 / ISO 27001 / none):

## 2. RPO / RTO

- [ ] Target RPO (max acceptable data loss), e.g. `5 min`:
- [ ] Target RTO (max acceptable time to restore), e.g. `1 h`:
- [ ] Signed off by workload owner on (date):
- [ ] Signed off by security / compliance on (date):

## 3. Backup method

- [ ] Logical backup configured (e.g. `pg_dump`, `mysqldump`, `mongodump`,
      `pg_basebackup`, export job): yes / no — tool and version:
- [ ] Physical backup configured (e.g. snapshot, `xtrabackup`, `pgBackRest`):
      yes / no — tool and version:
- [ ] Continuous / PITR enabled (WAL archive, binlog, oplog, S3 versioning,
      object generation): yes / no
- [ ] K8s state covered by Velero (if applicable): schedule name:
- [ ] Application-consistent (pre-freeze hook / quiesce) vs crash-consistent:

## 4. Frequency and retention

- [ ] Full backup frequency:
- [ ] Incremental / differential frequency:
- [ ] PITR window length (e.g. 7d WAL retained):
- [ ] Daily retention (e.g. 14d):
- [ ] Weekly retention (e.g. 12 weeks):
- [ ] Monthly retention (e.g. 12 months):
- [ ] Yearly / regulatory retention (e.g. 7y):
- [ ] Deletion policy documented (automatic lifecycle vs manual review):

## 5. 3-2-1 posture

- [ ] Copy 1 (primary / live):  location:
- [ ] Copy 2 (secondary / on-site backup): location, media type:
- [ ] Copy 3 (offsite): different region, different account or cloud, or
      physical vault — location, media type:
- [ ] At least 2 distinct media types:  (e.g. block + object, object + tape)
- [ ] At least one copy is immutable (Object Lock Compliance / Bucket Lock /
      WORM / tape vault): which copy, retention days:

## 6. Encryption at rest

- [ ] Encryption algorithm (AES-256 GCM / ChaCha20-Poly1305 / equivalent):
- [ ] KMS key ID / ARN:
- [ ] KMS key rotation cadence (annual minimum):
- [ ] Keys are in a different AWS account / GCP project / Azure tenant from
      the source workload (true / false):
- [ ] Envelope encryption in use (DEK wrapped by KEK): yes / no

## 7. Encryption in transit

- [ ] TLS 1.2+ for all backup network paths (agent → storage, cross-region
      replication): yes / no
- [ ] Mutual TLS where the storage is internal (e.g. internal MinIO): yes / no
- [ ] Certificate rotation covered by `ssl-certificate-manager`: yes / no

## 8. Access controls

- [ ] Write role (minimum privilege, no delete) — role name:
- [ ] Read / restore role (break-glass, gated) — role name:
- [ ] Delete role — role name and approval workflow (e.g. PR + two-person rule):
- [ ] MFA required for delete / override: yes / no
- [ ] Object Lock overrides disabled for root: yes / no
- [ ] Audit logs for every access event (CloudTrail / Audit Log / equivalent)
      flowing to the SIEM: yes / no

## 9. Integrity and verification

- [ ] Checksum verified at write (tool-native checksum, or SHA-256):
- [ ] Checksum re-verified weekly on a sampled object: yes / no
- [ ] Backup completion alert configured (missed backup → Alertmanager): yes / no
- [ ] Corruption alert (checksum mismatch → Alertmanager): yes / no

## 10. Restore tests

- [ ] Monthly sample restore (single row / object / namespace) — last run date,
      duration, result:
- [ ] Quarterly full restore to parallel environment — last run date, duration,
      measured RTO, measured RPO, result:
- [ ] Annual regional-failure tabletop — last run date, gaps found, fixes:
- [ ] Restore runbook exists at (URL):
- [ ] Restore runbook reviewed in the last 90 days: yes / no
- [ ] Ticket / evidence ID of the last successful restore:

## 11. Documentation

- [ ] Inventory row updated in the backup tracker (link):
- [ ] Runbook sections covered: take a backup, restore a backup, force-renew
      credentials, rotate KMS key, DR cutover, rollback:
- [ ] Contacts list (primary / secondary on-call, data owner, cloud
      account owner): up to date (true / false):

## 12. Sign-off

- [ ] Workload owner:                     signature / date:
- [ ] Platform / infra owner:             signature / date:
- [ ] Security reviewer:                  signature / date:
- [ ] Compliance reviewer (if regulated): signature / date:

## Tiered defaults (reference)

| Tier | RPO   | RTO  | Full cadence | Incremental     | Retention      | Restore tests                 |
|------|-------|------|--------------|-----------------|----------------|-------------------------------|
| 1    | 5 min | 1 h  | Weekly       | Every 15 min    | 30d + 7y PIT   | Monthly sample + quarterly full |
| 2    | 1 h   | 4 h  | Weekly       | Hourly          | 30d            | Monthly sample                |
| 3    | 24 h  | 24 h | Weekly       | Daily           | 14d            | Quarterly sample              |
