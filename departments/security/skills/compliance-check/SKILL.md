---
name: compliance-check
description: Use when the user asks for a "SOC 2 gap analysis", "ISO 27001 readiness check", or evidence collection for an upcoming audit. Maps SOC 2 Trust Service Criteria (CC1-CC9) and ISO 27001 Annex A controls against collected evidence, identifies gaps, and produces a remediation ticket list with owner/priority.
safety: writes-local
---

## When to use

Trigger on any of:

- "Prep for SOC 2 Type II" / "ISO 27001 gap analysis" / "evidence bundle".
- Quarterly compliance check cadence.
- Auditor requested a control matrix or walkthrough deck.
- Investor/customer security questionnaire needs underlying evidence.

Do not use this for HIPAA, PCI-DSS, or FedRAMP — those require specialised
control sets. This skill covers SOC 2 TSC + ISO 27001 Annex A.

## Inputs

- `FRAMEWORK` — `soc2` or `iso27001` or `both` (default: `soc2`).
- `EVIDENCE_DIR` — directory containing collected evidence artefacts
  (logs, config exports, screenshots, policy PDFs). Required.
- `ORG_META` — YAML with org name, fiscal period, scope boundary, owner map.
- `OUT_DIR` (default: `./compliance-out`).
- Optional env:
  - `JIRA_PROJECT` — if set, gap tickets are emitted as Jira-create JSON.
  - `TICKET_FORMAT` — `jira` | `github` | `markdown` (default: `markdown`).

Example `ORG_META`:
```yaml
org: "Acme Corp"
scope:
  systems: ["app-production", "data-warehouse", "corp-it"]
  regions: ["us-east-1", "eu-west-1"]
period:
  type: "type2"
  start: "2026-01-01"
  end:   "2026-12-31"
owners:
  CC1: "People Ops"
  CC2: "Security Eng"
  CC3: "Security Eng"
  CC4: "Security Eng"
  CC5: "IT"
  CC6: "Security Eng"
  CC7: "SRE"
  CC8: "Engineering"
  CC9: "Legal / Risk"
```

## Outputs

- `control-matrix.csv` — one row per control: `id, title, framework, owner,
  evidence_paths, design_ok, operating_ok, gap_summary`.
- `gaps.json` — machine-readable gap list.
- `gap-tickets.{md,json}` — ready-to-paste ticket list.
- `compliance-summary.md` — executive-level summary with readiness score.

## Tool dependencies

- `yq` + `jq`.
- `pandoc` (optional) — to export the evidence bundle as a PDF dossier.
- No external SaaS dependency; the skill is offline-first.

## Procedure

1. Parse `ORG_META` and validate required fields (org, scope, period,
   owners map covers every CC / Annex A domain).
2. Build the control inventory:
   - SOC 2: load `references/soc2-controls.md` and parse the table into a
     list of 64+ control points (CC1.1 - CC9.2, plus A, C, P categories if
     the period includes availability/confidentiality/privacy).
   - ISO 27001: parse Annex A 2022 (93 controls across 4 themes:
     Organizational, People, Physical, Technological).
3. Walk `$EVIDENCE_DIR` and catalog each artefact:
   `{path, sha256, type, period_covered, collected_at}`. Types include
   `policy`, `config_export`, `log_sample`, `screenshot`, `ticket_link`,
   `training_record`, `access_review`, `vulnerability_scan`.
4. Map evidence to controls via the `evidence_types` list in
   `references/soc2-controls.md` (e.g. CC6.1 requires `access_review` +
   `identity_provider_config` + `mfa_enforcement_proof`).
5. Assess each control:
   - **Design (ToD):** are the required artefact *types* present?
   - **Operating effectiveness (ToE):** do the artefact(s) cover the
     period with sufficient sampling (e.g. quarterly access reviews for
     a Type II year)?
   - Score: `pass` | `partial` | `fail` | `not_applicable`.
6. Produce gap list: any `partial` or `fail` becomes a gap with
   remediation steps drawn from the "Common deficiencies" column.
7. Emit tickets in the requested format:
   - Markdown: `- [ ] [CC6.1] Quarterly access review missing for EU
     region — owner: Security Eng — target: 2026-06-30`.
   - Jira JSON: fields `project`, `summary`, `description`,
     `priority`, `labels`, `components`.
   - GitHub issue JSON: `title`, `body`, `labels`, `assignees`.
8. Write `compliance-summary.md`:
   - Readiness score: `passed_controls / total_controls`.
   - Gap counts by severity (P0 blocking, P1 required, P2 nice-to-have).
   - Top 10 gaps by risk.
   - Framework coverage table.

## Examples

### Example 1 — SOC 2 Type II gap check

```
FRAMEWORK=soc2 \
EVIDENCE_DIR=./evidence-2026q1 \
ORG_META=./org.yaml \
OUT_DIR=./compliance-q1 \
./run-compliance.sh
```

Expected `compliance-summary.md` excerpt:

```
# Acme Corp — SOC 2 Type II Readiness (2026-01-01 .. 2026-12-31)

Readiness: 71% (46 / 64 controls passing)

Gaps by priority:
- P0 (blocking):  3
- P1 (required): 11
- P2 (nice):      4

Top gaps:
1. CC6.1 — MFA not enforced for break-glass accounts (P0)
2. CC7.2 — Incident response tabletop not run in last 12 months (P0)
3. CC4.1 — No evidence of quarterly vendor review (P1)
```

### Example 2 — Dual framework (SOC 2 + ISO 27001)

```
FRAMEWORK=both \
EVIDENCE_DIR=./evidence \
ORG_META=./org.yaml \
TICKET_FORMAT=github \
./run-compliance.sh
```

Expected log:

```
[compliance] SOC 2 controls: 64 (46 pass, 15 partial, 3 fail)
[compliance] ISO 27001 Annex A: 93 (71 pass, 18 partial, 4 fail)
[compliance] cross-mapped: 38 controls share evidence
[compliance] wrote gap-tickets.json (22 issues) for GitHub
```

## Constraints

- Never mark a control `pass` without an evidence artefact reference.
  A policy document alone is design-only; operating effectiveness needs
  a log, ticket, or system export.
- Evidence artefacts stay inside the user's boundary — do not upload,
  summarise to a third party, or include PII in tickets.
- Remediation steps must be specific actions, not "implement SOC 2".
- Do not back-date evidence. If an artefact's `collected_at` is outside
  the period window, mark the control `partial` and note the gap.
- Attestation language ("we are SOC 2 compliant") is never emitted — only
  a readiness score. Final attestation requires an auditor.

## Quality checks

- [ ] Every control has an `owner` from `ORG_META`; missing owners are
      surfaced as the first blocking gap.
- [ ] `control-matrix.csv` has one row per control and every cell filled.
- [ ] Evidence hashes (sha256) appear in `gaps.json` so auditors can
      verify the artefact wasn't swapped post-assessment.
- [ ] Readiness score matches the pass count divided by total controls.
- [ ] No ticket body contains raw evidence content — only the path.
