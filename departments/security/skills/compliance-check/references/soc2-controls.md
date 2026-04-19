# SOC 2 Trust Service Criteria — Control Reference

This reference drives the `compliance-check` skill. It enumerates the SOC 2
Trust Service Criteria (TSC) 2017 (with 2022 points of focus) common
controls (CC1 through CC9), the evidence types each control requires, how to
test design (ToD) and operating effectiveness (ToE), and the deficiencies
most frequently found.

The criteria are grouped as:
- CC1 — Control Environment
- CC2 — Communication and Information
- CC3 — Risk Assessment
- CC4 — Monitoring Activities
- CC5 — Control Activities
- CC6 — Logical and Physical Access Controls
- CC7 — System Operations
- CC8 — Change Management
- CC9 — Risk Mitigation

## CC1 — Control Environment

### CC1.1 — Demonstrates commitment to integrity and ethical values

- **Description:** The entity demonstrates a commitment to integrity and
  ethical values through published code of conduct and enforcement.
- **Evidence types:** `policy` (Code of Conduct, Ethics Policy),
  `training_record` (annual employee attestation), `ticket_link`
  (violation investigations, sanctioned cases).
- **Test of design:** Verify a Code of Conduct exists, is version
  controlled, and has been reviewed in the current fiscal year.
- **Test of effectiveness:** Sample 25 employees; confirm signed
  attestation timestamp within 30 days of hire and within the last 12
  months thereafter.
- **Common deficiencies:** stale policy (last reviewed >18 months ago);
  contractors excluded; no enforcement records when deficiencies are
  reported.

### CC1.2 — Board oversight

- **Description:** Board or equivalent exercises oversight responsibility
  for internal controls.
- **Evidence types:** `meeting_minutes` (board/security committee),
  `policy` (board charter), `org_chart`.
- **ToD:** Charter names a committee accountable for security; meeting
  cadence defined.
- **ToE:** Minutes for each scheduled meeting during the period; each
  includes a security agenda item.
- **Common deficiencies:** no dedicated security committee at seed/Series A
  orgs; minutes missing; security briefed <1x/year.

### CC1.3 — Organizational structure, authorities, and responsibilities

- **Evidence types:** `org_chart`, `job_descriptions`, `raci_matrix`.
- **ToD:** Documented structure, approved.
- **ToE:** Spot-check recent joiners; their role matches approved JD.
- **Common deficiencies:** no RACI for security functions; founders still
  hold operational roles without segregation.

### CC1.4 — Commitment to competence

- **Evidence types:** `training_record`, `hiring_rubric`,
  `performance_review` samples.
- **ToD:** Competency requirements defined per security role.
- **ToE:** Evidence of annual training for all in-scope engineers
  (secure-coding, phishing, data-handling).
- **Common deficiencies:** 100% training claim but LMS shows <90%
  completion; no re-test on failure.

### CC1.5 — Accountability for internal control

- **Evidence types:** `policy`, `performance_review`, `disciplinary_record`.
- **ToD:** Consequences for control failure documented.
- **ToE:** Where failures occurred in the period, evidence of action.
- **Common deficiencies:** no disciplinary evidence because no failures
  tracked (vs. no failures); policy references outdated roles.

## CC2 — Communication and Information

### CC2.1 — Information to support internal control

- **Evidence types:** `siem_config`, `log_retention_policy`, `dashboards`.
- **ToD:** SIEM sources list covers in-scope systems; retention meets
  policy (>= 1 year hot).
- **ToE:** Sample 10 days across the period, verify logs present and
  queryable; alert rules firing.
- **Common deficiencies:** services added to scope mid-period but not
  onboarded to SIEM; retention shorter than policy states.

### CC2.2 — Internal communication of control information

- **Evidence types:** `wiki_snapshot`, `announcement_archive`,
  `training_record`.
- **ToD:** Process for communicating control changes.
- **ToE:** For each policy change in the period, evidence of org-wide
  communication within 30 days.
- **Common deficiencies:** Slack announcement only, no durable record;
  contractors excluded.

### CC2.3 — External communication

- **Evidence types:** `policy` (customer comms, vulnerability disclosure),
  `ticket_link` (customer-reported issues).
- **ToD:** Published vuln disclosure policy or `security.txt`.
- **ToE:** Sampled external reports were acknowledged per SLA.
- **Common deficiencies:** no `security.txt`; disclosure email unmonitored.

## CC3 — Risk Assessment

### CC3.1 — Specifies objectives

- **Evidence types:** `risk_register`, `policy`.
- **ToD:** Documented control objectives aligned with TSC.
- **ToE:** Objectives reviewed in-period; linked to risk register rows.
- **Common deficiencies:** objectives copy-pasted from template, never
  refined to the org's context.

### CC3.2 — Identifies and assesses risks

- **Evidence types:** `risk_register`, `threat_model`, `pentest_report`.
- **ToD:** Methodology documented (likelihood x impact, 5x5 matrix).
- **ToE:** Risk register updated at least twice in a Type II period;
  each new system has a threat model.
- **Common deficiencies:** risk register last updated >12 months ago;
  no linkage between threat models and CC3.2 register rows.

### CC3.3 — Considers potential for fraud

- **Evidence types:** `fraud_risk_assessment`, `segregation_of_duties_matrix`.
- **ToD:** Fraud scenarios enumerated for finance-adjacent systems.
- **ToE:** SoD matrix enforced in IAM; exceptions approved.
- **Common deficiencies:** one engineer with both deploy + DB write
  production access.

### CC3.4 — Identifies and assesses changes

- **Evidence types:** `change_log`, `architecture_review_records`.
- **ToD:** Process to re-evaluate risk on significant change.
- **ToE:** Every major arch change in period has a risk review.
- **Common deficiencies:** architectures shift (e.g. added AI vendor)
  without risk reassessment.

## CC4 — Monitoring Activities

### CC4.1 — Ongoing and separate evaluations

- **Evidence types:** `vulnerability_scan`, `pentest_report`,
  `internal_audit_report`, `control_self_assessment`.
- **ToD:** Schedule of evaluations (daily vuln scan, annual pentest,
  quarterly control review) documented.
- **ToE:** Evidence for each scheduled run within the period.
- **Common deficiencies:** pentest "scheduled annually" but last one
  >14 months ago; vuln scans suspended during migration.

### CC4.2 — Communicates deficiencies

- **Evidence types:** `ticket_link` (remediation tickets), `risk_register`
  updates, `exec_reporting`.
- **ToD:** Process to escalate findings.
- **ToE:** For each Critical/High finding, a ticket with SLA tracking;
  exec reporting at defined cadence.
- **Common deficiencies:** findings closed without remediation evidence;
  exec deck missing open-Critical count.

## CC5 — Control Activities

### CC5.1 — Selects and develops control activities

- **Evidence types:** `policy`, `control_matrix`.
- **ToD:** Control matrix maps risks to controls.
- **ToE:** Each control has an owner and testing cadence.
- **Common deficiencies:** control matrix exists but is not used operationally.

### CC5.2 — Selects and develops general controls over technology

- **Evidence types:** `config_export` (IAM, MFA, encryption at rest),
  `iac_pipeline_logs`.
- **ToD:** Tech controls documented and configured.
- **ToE:** Samples confirm drift-free state; drift detection alerting.
- **Common deficiencies:** S3 public-access block disabled in one account;
  manual IAM changes out-of-band of IaC.

### CC5.3 — Deploys control activities through policies and procedures

- **Evidence types:** `policy`, `runbook`, `onboarding_checklist`.
- **ToD:** Operational policies for each control family.
- **ToE:** Runbook execution artefacts for incidents, access grants, etc.
- **Common deficiencies:** runbooks are README.md in a repo no one owns.

## CC6 — Logical and Physical Access Controls

### CC6.1 — Logical access security software, infrastructure, and architectures

- **Evidence types:** `identity_provider_config` (Okta/Azure AD/Google
  Workspace), `mfa_enforcement_proof`, `vpn_config`, `sso_app_list`.
- **ToD:** Centralized IdP, MFA enforced, SSO for all in-scope apps.
- **ToE:** 0 users with password-only auth; MFA required on every login
  in sampled audit logs; break-glass accounts documented and rotated.
- **Common deficiencies:** MFA enforced for humans but not for service
  accounts with broad scope; break-glass creds in a shared vault with
  no access log.

### CC6.2 — Authorization (new access)

- **Evidence types:** `access_request_tickets`, `approver_matrix`.
- **ToD:** Documented access request/approval workflow.
- **ToE:** Sampled new hires had tickets with approvals before access
  granted; SLAs met.
- **Common deficiencies:** engineers granted production access on day 1
  without JD requiring it; approvals self-approved.

### CC6.3 — Role-based access, least privilege

- **Evidence types:** `iam_policy_dump`, `role_assignments`, `jml_process`.
- **ToD:** Roles defined; JML (Joiner/Mover/Leaver) process in place.
- **ToE:** Sample movers — access removed in <= 24h; sample leavers —
  all access revoked same day.
- **Common deficiencies:** movers retain old role indefinitely; leavers
  still have GitHub access days later.

### CC6.4 — Physical access

- **Evidence types:** `badge_system_export`, `visitor_log`,
  `office_access_policy`, `data_center_soc1`.
- **ToD:** Physical access controls documented; data center SOC 1
  obtained from provider.
- **ToE:** Badge logs reviewed quarterly; visitor logs for each office day.
- **Common deficiencies:** fully remote org skips this entirely (still
  required — document N/A with rationale); data center SOC 1 expired.

### CC6.5 — Data disposal

- **Evidence types:** `hardware_disposal_certificates`,
  `data_retention_policy`, `crypto_erase_evidence`.
- **ToD:** Retention and destruction policy.
- **ToE:** Disposal certificates for decommissioned hardware in period;
  evidence of crypto-erase for cloud resources.
- **Common deficiencies:** no cert for a laptop offboarded mid-period;
  S3 buckets not lifecycled.

### CC6.6 — Boundary protection

- **Evidence types:** `waf_config`, `firewall_rules`, `vpc_flow_logs`.
- **ToD:** WAF/firewall in front of all in-scope services.
- **ToE:** Rule change log; no 0.0.0.0/0 ingress to sensitive ports.
- **Common deficiencies:** legacy jumphost with SSH open to the internet;
  WAF set to `Count` mode not `Block`.

### CC6.7 — Data in transit

- **Evidence types:** `tls_config_scan`, `cert_inventory`, `mtls_proofs`.
- **ToD:** TLS 1.2+ enforced; cert rotation automated.
- **ToE:** SSL Labs A grade or equivalent on external endpoints;
  cert renewal logs.
- **Common deficiencies:** internal service-to-service plaintext;
  expired cert within period.

### CC6.8 — Malicious software

- **Evidence types:** `edr_deployment_report`, `quarantine_events`.
- **ToD:** EDR/antivirus on all in-scope endpoints.
- **ToE:** Coverage >= 95% across the period; every quarantine event
  has a follow-up ticket.
- **Common deficiencies:** personal MacBooks missing EDR; linux
  engineering fleet excluded.

## CC7 — System Operations

### CC7.1 — Detection of vulnerabilities

- **Evidence types:** `vulnerability_scan`, `cve_sla_report`, `sbom`.
- **ToD:** Scanning cadence (>= weekly) and SLA defined.
- **ToE:** Scan results across period; SLA adherence > 95%.
- **Common deficiencies:** internal services unscanned; Critical CVE open
  past SLA.

### CC7.2 — Monitors system components and anomalies

- **Evidence types:** `alert_rule_inventory`, `alert_firing_logs`,
  `on_call_schedule`.
- **ToD:** Alerts configured for security-relevant events.
- **ToE:** On-call response times within SLO; alerts acknowledged.
- **Common deficiencies:** alerts exist but nobody on-call for them
  ("noise channel"); dashboards built but never reviewed.

### CC7.3 — Security incidents

- **Evidence types:** `incident_runbook`, `incident_tickets`,
  `postmortems`, `tabletop_exercise_report`.
- **ToD:** IR plan documented, roles assigned.
- **ToE:** Every incident in period has a ticket + postmortem;
  tabletop run at least once.
- **Common deficiencies:** tabletop not run within the fiscal year;
  postmortems missing remediation action tracking.

### CC7.4 — Incident response

- **Evidence types:** `comms_plan`, `customer_notifications`,
  `regulator_notifications`.
- **ToD:** Breach comms plan with legal/PR alignment.
- **ToE:** Sample incidents followed plan; notifications within legal SLA
  (e.g. GDPR 72h).
- **Common deficiencies:** comms plan untested; legal not looped in time.

### CC7.5 — Business continuity and recovery

- **Evidence types:** `dr_plan`, `dr_test_report`, `backup_logs`,
  `rpo_rto_evidence`.
- **ToD:** DR plan with RPO/RTO per system.
- **ToE:** Annual DR test; backups verified restorable in period.
- **Common deficiencies:** backups exist but never restore-tested;
  RPO/RTO stated but not measured.

## CC8 — Change Management

### CC8.1 — Changes authorized, tested, approved, and documented

- **Evidence types:** `pr_history`, `code_review_enforcement`,
  `deploy_logs`, `cab_minutes` (for large changes).
- **ToD:** Branch protection, required reviews, CI checks.
- **ToE:** Sample 25 prod deploys; each traces to a reviewed+CI-passed PR.
- **Common deficiencies:** "hotfix" direct pushes bypassing review;
  reviewer == author; CI checks optional.

## CC9 — Risk Mitigation

### CC9.1 — Identifies, selects, and develops risk mitigation activities

- **Evidence types:** `risk_register_updates`, `mitigation_tickets`.
- **ToD:** For each high risk, a mitigation plan.
- **ToE:** Plans tracked to closure.
- **Common deficiencies:** accepted risks never revisited;
  mitigations marked "done" without evidence.

### CC9.2 — Vendor management

- **Evidence types:** `vendor_inventory`, `vendor_soc2_or_questionnaire`,
  `dpa_executed`, `vendor_risk_assessment`.
- **ToD:** Vendor onboarding process with security review.
- **ToE:** Sampled in-period new vendors have a completed security
  review and signed DPA before production data touched them.
- **Common deficiencies:** SaaS added via self-serve credit card without
  security review; AI subprocessors not tracked.

## Optional categories (add if in scope)

- **A (Availability)** — A1.1, A1.2, A1.3 — redundancy, environmental
  protection, capacity planning.
- **C (Confidentiality)** — C1.1, C1.2 — data classification, secure
  disposal of confidential info.
- **P (Privacy)** — P1-P8 — covers notice, choice, collection limitation,
  use/retention/disposal, access, disclosure, quality, monitoring.
- **PI (Processing Integrity)** — PI1.1-PI1.5 — input validation,
  processing completeness and accuracy, output correctness.

Teams should only add these when their client scope requires them;
including them without evidence will tank the readiness score.
