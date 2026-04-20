---
name: compliance-remediation
description: Use when compliance-check has produced control gaps (SOC2, ISO 27001, HIPAA, PCI) and you need to close them. Classifies each gap as Design / Operating / Evidence, drafts or configures the missing policy / control / evidence artifact, maps the closure to the control ID, and assembles the auditor-ready evidence locker.
safety: writes-shared
produces: security/remediation/compliance-<framework>-<date>.md
consumes:
  - security/findings/compliance.json
---

## When to use

- `compliance-check` has produced `security/findings/compliance.json` with one or more gap findings.
- A Drata / Vanta / Secureframe / Thoropass test has failed and requires engineering action.
- An auditor interim walkthrough surfaced control deficiencies that need closure before the audit period ends.
- A new framework is being adopted (e.g. moving from SOC2 Type I to Type II, or adding ISO 27001) and you need to close gaps surfaced by the readiness assessment.

Do not use this skill to perform the audit itself — that's `compliance-check`. Do not use it for CVE closure — that's `dependency-remediation` or `vulnerability-remediation`.

## Inputs

- `security/findings/compliance.json` with control IDs, gap classification, and evidence.
- The framework's control register (Trust Service Criteria for SOC2, Annex A for ISO 27001, etc.).
- Write access to the policy repo (`policies/`), config management (IAM, Okta, logging), and the evidence store.
- Stakeholders mapped per control family (HR for CC1, Security for CC6, Eng for CC8, etc.).

## Outputs

- `security/remediation/compliance-<framework>-<date>.md` — per-gap remediation trail.
- New or updated policy documents under `compliance/<framework>/<control-id>/policy.md`.
- Technical control configurations (IAM policies, SSO groups, monitoring rules, access-review reports).
- Evidence artifacts collected and stored under `compliance/<framework>/<control-id>/evidence/<date>-<artifact>.{pdf,json,png}`.
- Test-of-effectiveness documentation under `compliance/<framework>/<control-id>/tests.md`.

## Tool dependencies

- Cloud / SaaS CLIs: `aws`, `gcloud`, `okta-awscli`, `gh`, `tsc` (Drata), or Vanta / Secureframe APIs.
- `git` (policy docs in version control).
- An evidence locker — S3 with Object Lock, Google Drive with restricted sharing, or a GRC platform's evidence module.
- A diagramming tool (Mermaid / draw.io) for policy flowcharts.

## Procedure

1. **Classify each gap into one of three types.** This determines the remediation path.

   | Type | Diagnosis | Fix requires |
   |---|---|---|
   | **Design gap** | Policy missing, control not designed | Draft policy, get it approved, communicate to staff |
   | **Operating gap** | Policy exists, control inconsistently applied | Configure the technical control / enforce via automation |
   | **Evidence gap** | Control works, no artifact proves it over the audit period | Set up automatic collection into the evidence locker |

2. **Close Design gaps by drafting a policy.** Every policy follows the same minimum structure:
   ```markdown
   # <Policy Name>

   ## Purpose
   Two sentences: what this policy governs and why.

   ## Scope
   Which systems, roles, or data classifications this applies to.

   ## Policy
   The required behavior — phrased as "must" statements.

   ## Procedure
   Numbered steps for implementing the policy.

   ## Roles (RACI)
   | Activity | Responsible | Accountable | Consulted | Informed |

   ## Exceptions
   Who approves, time-bound, compensating control requirement.

   ## Review
   Owner + cadence (annual is minimum for most SOC2 policies).

   ## References
   - Related controls: <framework>:<control-id>
   - Related policies: <links>
   ```

   Ship the policy via PR → CTO / CISO approval → store in `compliance/<framework>/<control-id>/policy.md` → announce in #all-hands or onboarding docs.

3. **Close Operating gaps by configuring the control.** Map control IDs to concrete infrastructure actions:

   **SOC2 CC6.1 (Logical access) — MFA enforcement:**
   ```bash
   # AWS account-wide password policy
   aws iam update-account-password-policy \
     --minimum-password-length 14 \
     --require-symbols --require-numbers \
     --require-uppercase-characters --require-lowercase-characters \
     --max-password-age 90 --password-reuse-prevention 12

   # SCP denying actions without MFA
   cat > scp-require-mfa.json <<'EOF'
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "DenyAllExceptMfaLogin",
       "Effect": "Deny",
       "Action": "*",
       "Resource": "*",
       "Condition": {"BoolIfExists": {"aws:MultiFactorAuthPresent": "false"}}
     }]
   }
   EOF
   aws organizations create-policy --type SERVICE_CONTROL_POLICY \
     --name RequireMFA --content file://scp-require-mfa.json
   ```

   **SOC2 CC6.2 (Access provisioning) — SSO + JIT access:**
   ```bash
   # Okta → AWS SSO via SAML; group-based role mapping
   # Each role mapped to an Okta group reviewed quarterly
   aws sso-admin create-permission-set --instance-arn <arn> \
     --name EngineeringRead --session-duration PT4H
   ```
   Document access review in `compliance/soc2/CC6.2/procedure.md`; schedule via calendar invite.

   **SOC2 CC7.2 (Monitoring) — CloudTrail + GuardDuty org-wide:**
   ```bash
   aws cloudtrail create-trail --name org-trail --s3-bucket-name audit-logs-<acct> \
     --is-organization-trail --is-multi-region-trail --enable-log-file-validation
   aws cloudtrail start-logging --name org-trail
   aws guardduty create-detector --enable --finding-publishing-frequency FIFTEEN_MINUTES
   ```
   Alert on root account usage via EventBridge → SNS → PagerDuty.

   **SOC2 CC8.1 (Change management) — branch protection + signed commits:**
   ```bash
   gh api repos/acme/api/branches/main/protection -X PUT \
     -f required_status_checks.strict=true \
     -F required_status_checks.contexts='["ci/tests","ci/security-audit"]' \
     -f enforce_admins=true \
     -F required_pull_request_reviews.required_approving_review_count=2 \
     -F required_pull_request_reviews.require_code_owner_reviews=true \
     -f required_signatures=true
   ```

4. **Close Evidence gaps by setting up automatic collection.** Every control needs a dated artifact in the evidence locker for every month of the audit period. Examples:

   **Access review evidence (CC6.2):**
   ```bash
   # Monthly cron: pull Okta group membership, commit to evidence locker
   okta-awscli --export-groups > compliance/soc2/CC6.2/evidence/$(date +%Y-%m)-okta-groups.json
   ```

   **Backup verification evidence (CC7.5 / A.12.3):**
   ```bash
   # After each restore test
   velero backup describe daily-$(date +%F) --details \
     > compliance/soc2/CC7.5/evidence/$(date +%F)-restore-test.log
   ```

   **Vulnerability-management evidence (CC7.1):**
   Archive the weekly output of `full-security-audit` into `compliance/soc2/CC7.1/evidence/<date>-audit.json`. Retain for 2 years to cover a Type II audit period.

   **Monitoring evidence (CC7.2):**
   Daily AWS Config snapshot proving GuardDuty was enabled:
   ```bash
   aws configservice describe-configuration-recorders > \
     compliance/soc2/CC7.2/evidence/$(date +%F)-config-state.json
   # ensure S3 bucket has Object Lock on for tamper resistance
   ```

5. **Build the evidence locker structure.** Per-control-per-framework:
   ```
   compliance/
   └── soc2/
       ├── CC6.1/
       │   ├── policy.md                       # design
       │   ├── procedure.md                    # operating
       │   ├── tests.md                        # test of effectiveness
       │   └── evidence/
       │       ├── 2026-01-okta-mfa-export.json
       │       ├── 2026-02-okta-mfa-export.json
       │       └── ...
       └── CC7.2/
           ├── policy.md
           ├── procedure.md
           ├── tests.md
           └── evidence/
               ├── 2026-01-guardduty-config.json
               └── ...
   ```

6. **Document the test of effectiveness** per control in `tests.md`. Auditors need to see HOW you verify the control works, not just that it exists. Template:
   ```markdown
   # Test of effectiveness — CC6.1 (MFA enforcement)

   ## Test design
   Sample 10 human user accounts across the audit period. For each:
   1. Confirm MFA is enrolled in Okta.
   2. Attempt login without MFA in a controlled test account; expect denial.
   3. Verify CloudTrail logs show no MFA-less API calls for that user.

   ## Sampling strategy
   Stratified random: 5 engineering, 3 non-eng, 2 contractors. Monthly.

   ## Expected outcome
   100% of sampled accounts have MFA enrolled; 0 MFA-less logins in CloudTrail.
   ```

7. **Write the remediation report.** `compliance-<framework>-<date>.md` contains:
   - Summary table: control ID · gap type · status (closed / in-progress / exception) · evidence links.
   - Per-gap detail: description, remediation action taken, policy link, procedure link, evidence link, owner.
   - Residual risk register (gaps not yet closed with target close date).
   - Next audit-period actions (recurring evidence collection schedule).

## Examples

### Example 1 — SOC2 CC6.1 Design gap: no documented access-provisioning policy

`compliance.json` excerpt:
```json
{
  "findings": [
    {
      "control": "SOC2:CC6.1",
      "gap_type": "design",
      "description": "No formal Access Management Policy exists. Access is granted ad-hoc by the hiring manager.",
      "severity": "HIGH"
    }
  ]
}
```

Remediation:

1. Draft policy (`compliance/soc2/CC6.1/policy.md`):
   ```markdown
   # Access Management Policy

   ## Purpose
   Define how access to Acme production systems and sensitive data is granted, reviewed, and revoked.
   Ensures least privilege and timely de-provisioning.

   ## Scope
   All employees, contractors, and service accounts with access to any system classified Internal or Confidential.

   ## Policy
   - All human access must use SSO via Okta. No local accounts on production systems.
   - All human access must require MFA.
   - Access requests must be submitted via the Access Request JIRA template.
   - Manager approval is required for any role assignment.
   - Quarterly access reviews are performed; removal of unnecessary access within 5 business days of review.
   - De-provisioning occurs within 1 hour of termination (automated via HRIS → Okta deactivation).

   ## Procedure
   1. Request: employee files ACCESS-REQ ticket with requested role.
   2. Approval: manager + system owner.
   3. Grant: Okta admin assigns to the Okta group mapped to the role.
   4. Review: quarterly access review run by Security lead.
   5. Revoke: HRIS termination hook triggers Okta deactivation; automated.

   ## Roles (RACI)
   | Activity | Responsible | Accountable | Consulted | Informed |
   |---|---|---|---|---|
   | Request | Employee | Manager | System owner | Security |
   | Approval | Manager | System owner | Security | — |
   | Review | Security | CTO | Managers | Auditors |
   | Revocation | IT/HRIS | Security | — | Managers |

   ## Exceptions
   Time-bound (≤ 30 days), approved by CTO + CISO, with compensating control and review date.

   ## Review
   Owner: Head of Security. Cadence: annual.

   ## References
   - SOC2 CC6.1, CC6.2, CC6.3
   - ISO 27001 A.9.1, A.9.2
   ```

2. PR review → CTO approval → merge → announce in #all-hands.

3. Implement the technical control (Okta groups mapped to SSO roles):
   ```bash
   # already documented above; confirm the Okta → AWS SSO mapping
   ```

4. Kick off first quarterly access review; save the output to evidence:
   ```bash
   okta-awscli --export-groups > compliance/soc2/CC6.1/evidence/2026-Q2-access-review.json
   ```

Report excerpt:
```markdown
### SOC2:CC6.1 — Access Management Policy (Design gap)
- Status: closed
- Policy: compliance/soc2/CC6.1/policy.md (approved 2026-04-20)
- Procedure: Okta → AWS SSO with quarterly review; next review 2026-07-15
- First evidence: compliance/soc2/CC6.1/evidence/2026-Q2-access-review.json
- Owner: Head of Security (@security-lead)
```

### Example 2 — SOC2 CC7.2 Evidence gap: GuardDuty enabled but no continuity proof

`compliance.json` excerpt:
```json
{
  "findings": [
    {
      "control": "SOC2:CC7.2",
      "gap_type": "evidence",
      "description": "GuardDuty is enabled but there is no artifact proving continuous enablement throughout the audit period.",
      "severity": "MEDIUM"
    }
  ]
}
```

Remediation:

1. Configure AWS Config to record the GuardDuty configuration-recorder state continuously:
   ```bash
   aws configservice put-configuration-recorder \
     --configuration-recorder '{"name":"default","roleARN":"arn:aws:iam::...","recordingGroup":{"allSupported":true,"includeGlobalResourceTypes":true}}'
   aws configservice start-configuration-recorder --configuration-recorder-name default
   ```

2. Daily EventBridge schedule → Lambda → writes a dated snapshot to the evidence S3 bucket with Object Lock:
   ```python
   # lambda_function.py
   import boto3, json, datetime
   def handler(event, _):
     gd = boto3.client("guardduty")
     det_ids = gd.list_detectors()["DetectorIds"]
     state = [gd.get_detector(DetectorId=d) for d in det_ids]
     key = f"soc2/CC7.2/evidence/{datetime.date.today():%Y-%m-%d}-guardduty-state.json"
     boto3.client("s3").put_object(
       Bucket="audit-evidence-acme",
       Key=key,
       Body=json.dumps(state, default=str).encode(),
       ObjectLockMode="COMPLIANCE",
       ObjectLockRetainUntilDate=datetime.datetime.utcnow() + datetime.timedelta(days=730),
     )
   ```

3. Document the test of effectiveness (`compliance/soc2/CC7.2/tests.md`):
   ```markdown
   # Test of effectiveness — CC7.2 (GuardDuty continuous monitoring)
   Sampling: pick 3 random days per month of the audit period; fetch the dated snapshot from S3;
   verify `Status: ENABLED` and `DataSources.CloudTrail.Status: ENABLED`.
   Expected: 100% of sampled days show ENABLED state across all production accounts.
   ```

Report excerpt:
```markdown
### SOC2:CC7.2 — GuardDuty continuous-enablement evidence (Evidence gap)
- Status: closed
- Control: GuardDuty enabled org-wide; CloudTrail data source enabled.
- Evidence pipeline: EventBridge (daily 00:00 UTC) → Lambda `cc7-2-guardduty-snapshot` → S3 `audit-evidence-acme` with 2-year Object Lock.
- First evidence: compliance/soc2/CC7.2/evidence/2026-04-20-guardduty-state.json
- Retention: 730 days (covers SOC2 Type II 12-month period + 1y buffer).
- Owner: Head of Security.
```

## Constraints

- Never mark a gap "closed" without an artifact that an auditor could verify (policy link, config snapshot, evidence file path).
- Never ship a policy you cannot operationally follow — auditors test what you write. If you can't do monthly access reviews, don't promise monthly.
- Never skip the test-of-effectiveness documentation; it's what transforms a written policy into Type II-audit-ready evidence.
- Do not store evidence on a mutable location (employee laptop, Slack message). Use Object-Lock S3, GRC tool evidence module, or equivalent tamper-resistant store.
- Do not leave an Operating gap open with only a policy fix — if a control is not technically enforced, it's a design-only win.

## Quality checks

- Every finding in `compliance.json` has a row in the remediation report with a status and evidence link.
- Every policy drafted is merged to `policies/` (or equivalent) with an approval trail.
- Every technical control configured has a reproducible command / IaC snippet in the report.
- Every evidence-collection pipeline is runnable and has produced at least one artifact at the time of reporting.
- Re-run `compliance-check` → originally-open gaps are marked closed (or carry a documented exception with review date).
