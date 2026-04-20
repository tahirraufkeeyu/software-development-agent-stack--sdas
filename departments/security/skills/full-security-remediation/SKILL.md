---
name: full-security-remediation
description: Use when full-security-audit has produced findings across secrets, dependencies, SAST/DAST, containers, and compliance, and you want to close them end-to-end. Dispatches each class of finding to the paired remediation skill, re-runs the originating scanner to verify closure, computes before/after deltas, and writes a consolidated remediation report with residuals, exceptions, and follow-up tickets.
safety: writes-shared
produces: security/remediation/full-remediation-<date>.md
consumes:
  - security/findings/secrets.json
  - security/findings/dependencies.json
  - security/findings/audit.json
  - security/findings/container.json
  - security/findings/compliance.json
chains:
  - secret-remediation
  - dependency-remediation
  - vulnerability-remediation
  - container-remediation
  - compliance-remediation
---

## When to use

- You have run `full-security-audit` and all 5 findings JSONs exist under `security/findings/`.
- A release is gated on closing High+ findings across multiple classes and you want a single orchestrated cycle rather than running each remediation skill manually.
- An incident response has mandated a full security sweep + closure within a fixed deadline.
- Pre-audit readiness: an external pen-test or SOC2 observation window starts soon and you need a consolidated before/after report.

Do not use this skill to run the audit itself — that's `full-security-audit`. Do not use it when only one class of finding exists — invoke the specific remediation skill directly.

## Chained skills

1. **`secret-remediation`** — rotates leaked credentials, rewrites git history, installs prevention controls. Always runs FIRST if any secret findings exist.
2. **`dependency-remediation`** — upgrades / overrides / replaces vulnerable packages, commits lockfile changes, re-runs audit.
3. **`vulnerability-remediation`** — fixes SAST/DAST findings in code and config with regression tests per finding.
4. **`container-remediation`** — rebases container images, hardens Dockerfiles, rebuilds clean, re-scans with Trivy. Runs only if a Dockerfile exists in the repo.
5. **`compliance-remediation`** — closes SOC2/ISO control gaps with policy, technical control, and evidence artifacts.

## Inputs

- `security/findings/secrets.json`
- `security/findings/dependencies.json`
- `security/findings/audit.json`
- `security/findings/container.json` (optional — skipped if missing)
- `security/findings/compliance.json`

The orchestrator expects all required JSONs to exist. A missing non-optional input is an error — re-run `full-security-audit` first.

## Outputs

- `security/remediation/full-remediation-<date>.md` — consolidated remediation report.
- Individual remediation reports linked: `secrets-<date>.md`, `dependencies-<date>.md`, `vulnerabilities-<date>.md`, `container-<image>-<date>.md`, `compliance-<framework>-<date>.md`.
- A release-gate verdict: PASS (no HIGH+ residuals without approved exception) or FAIL.

## Tool dependencies

- All tools required by the 5 chained remediation skills (see their SKILL.md).
- `jq` for parsing findings and computing deltas.
- A ticketing system CLI for follow-up tickets: `gh issue create`, Jira REST, Linear CLI, etc.

## Procedure

1. **Preflight — verify inputs.** Confirm the 4 required findings JSONs exist and are not older than 24 hours:
   ```bash
   for f in secrets dependencies audit compliance; do
     test -f security/findings/$f.json || { echo "missing $f.json"; exit 1; }
     age=$(( $(date +%s) - $(stat -f %m security/findings/$f.json 2>/dev/null || stat -c %Y security/findings/$f.json) ))
     (( age < 86400 )) || echo "WARN: $f.json is >24h old"
   done
   ```
   `container.json` is optional — skipped if absent.

2. **Compute the before snapshot.** Per findings file, count by severity:
   ```bash
   jq '.findings | group_by(.severity) | map({severity: .[0].severity, count: length})' \
     security/findings/secrets.json
   ```
   Persist to `security/remediation/.snapshot-before-<date>.json` for the delta computation in step 8.

3. **Run `secret-remediation` FIRST and wait.** Leaked credentials are the highest-priority remediation — every downstream action risks exposing them further (force-push + re-scan both touch git). If `secrets.json` has any findings classified as a real leak (not false-positive):
   - Invoke `secret-remediation`.
   - Block until the `secret-remediation` report confirms rotation + invalidation + history rewrite for every real leak.
   - If rotation fails for any credential (provider 5xx, missing admin access), halt the orchestrator and page on-call. Do not proceed — running dependency upgrades / rebuilds while credentials are still live would compound the leak.

4. **Dispatch the remaining remediation skills in parallel.** Once secrets are handled, these are independent:

   | Skill | Triggered by |
   |---|---|
   | `dependency-remediation` | `dependencies.json` has non-empty findings |
   | `vulnerability-remediation` | `audit.json` has non-empty findings |
   | `container-remediation` | `container.json` exists and has findings; repo has a Dockerfile |
   | `compliance-remediation` | `compliance.json` has non-empty findings |

   Each runs in its own branch / PR to keep changes reviewable. Collect the output report path from each.

5. **Re-run scanners to verify closure.** After each remediation completes, re-invoke the paired scanner and record the delta:
   - `secret-remediation` → re-run `secret-scanner`; expect 0 findings for the original secret values.
   - `dependency-remediation` → re-run `dependency-audit`; expect the original CVE IDs to be absent or explicitly suppressed.
   - `vulnerability-remediation` → re-run `security-audit`; expect original rule+path pairs to return no matches.
   - `container-remediation` → re-run `container-scan` with Trivy on the new image tag; expect 0 CRITICAL/HIGH CVEs.
   - `compliance-remediation` → re-run `compliance-check`; expect originally-open controls marked closed (or carrying documented exceptions).

6. **Identify residuals.** A residual is a finding that persists after remediation. For each residual, classify as:
   - **Exception approved** — business justification, compensating control, owner, review date ≤ 60 days. Documented in the report.
   - **Follow-up ticket** — cannot remediate now, but owned and deadline-tracked. File the ticket and link it.
   - **False positive re-evaluated** — scanner rule is wrong for our context; document the allowlist with evidence.

7. **File follow-up tickets.** For every residual that is not an approved exception:
   ```bash
   gh issue create \
     --title "SEC-RESIDUAL: <CVE or rule> — <short desc>" \
     --label "security,sec-residual" \
     --body "See security/remediation/full-remediation-<date>.md#<anchor>. Owner: @<handle>. Due: <date>."
   ```

8. **Write the consolidated report** at `security/remediation/full-remediation-<date>.md`:

   Executive summary:
   - Audit date (from `full-security-audit` run).
   - Remediation cycle date.
   - Before-counts by severity, after-counts by severity, delta.
   - Overall risk level before → after (computed by `pentest-report` weighting, reused here).
   - PASS / FAIL verdict against release gate.

   Per-class detail:
   - Secrets: findings handled, rotations completed, history-rewrite scope, prevention controls installed. Link to `secrets-<date>.md`.
   - Dependencies: CVEs closed, packages changed, exceptions. Link to `dependencies-<date>.md`.
   - Vulnerabilities: findings closed by category (injection, XSS, authz, …), regression tests added, exceptions. Link to `vulnerabilities-<date>.md`.
   - Containers: image digests before/after, CVE count delta, Dockerfile hardening summary. Link to `container-<image>-<date>.md`.
   - Compliance: controls closed by type (Design / Operating / Evidence), policies drafted, evidence pipelines set up. Link to `compliance-<framework>-<date>.md`.

   Residuals table:
   | ID | Class | Severity | Status | Justification | Owner | Review date |

   Exceptions register:
   | ID | Control / CVE | Compensating control | Owner | Review date |

   Follow-up tickets:
   | Ticket | Class | Owner | Due |

9. **Link from pentest-report.** Append a "Remediation Status" section to the most recent `pentest-report-<date>.md` with a link back to this full-remediation report so future audits have traceability from finding → remediation → verification.

## Examples

### Example 1 — full cycle, clean closure

`full-security-audit` findings:
- Secrets: 1 HIGH (AWS access key)
- Dependencies: 12 CVEs (2 HIGH, 10 MEDIUM)
- Vulnerabilities: 5 findings (1 HIGH stored-XSS, 4 MEDIUM missing security headers)
- Containers: 3 CVEs on the API image (2 HIGH, 1 MEDIUM)
- Compliance: 2 gaps (SOC2 CC6.1 Design, CC7.2 Evidence)

Orchestration:

1. Preflight: 4 required JSONs present, all < 4h old. `container.json` present.
2. `secret-remediation` runs first:
   - AWS key `AKIAI…` rotated, new key in Secrets Manager, old key deleted, CloudTrail clean.
   - Git history rewritten across `main` and `release/2.14` via `git filter-repo`; force-pushed.
   - Pre-commit gitleaks hook + CI workflow + `.env` → `.gitignore` added.
   - Report: `security/remediation/secrets-2026-04-20.md`.
3. In parallel (4 PRs):
   - `dependency-remediation`: 10 direct upgrades + 2 transitive overrides; SBOM regenerated; tests green.
   - `vulnerability-remediation`: XSS fixed via DOMPurify; helmet + CSP + HSTS added; 5 regression tests added.
   - `container-remediation`: rebased `node:18-slim` → `distroless/nodejs20`; multi-stage; non-root; 832MB → 142MB; Trivy clean.
   - `compliance-remediation`: Access Management Policy drafted + CTO-approved; GuardDuty daily-snapshot Lambda deployed; 2 controls closed.
4. Re-scan:
   - `secret-scanner` → 0 findings.
   - `dependency-audit` → 0 of original 12 CVEs; 1 newly-surfaced MEDIUM accepted with exception (vendor patch ETA 2026-05-15).
   - `security-audit` → 0 of original 5 findings.
   - `container-scan` → 0 HIGH, 0 CRITICAL on new image.
   - `compliance-check` → both original gaps closed.
5. Residuals: 1 MEDIUM dependency CVE accepted with exception. 0 HIGH+ residuals.
6. Follow-up tickets: TECH-812 (drop minimist override when mkdirp upgraded).
7. Verdict: **PASS** — no HIGH+ residuals without approved exception.

Executive summary excerpt:
```markdown
Before → After:
  CRITICAL  0 → 0
  HIGH      6 → 0
  MEDIUM   15 → 1 (accepted exception, review 2026-05-15)

Overall risk: HIGH → LOW.
Release gate: PASS.
```

### Example 2 — partial closure, escalations required

`full-security-audit` findings:
- Secrets: 0.
- Dependencies: 1 HIGH CVE in a deep-transitive that has no patch.
- Vulnerabilities: 0.
- Containers: 1 HIGH CVE in base image with no patched alternative tag yet.
- Compliance: 1 gap requiring a vendor SOC2 report not yet delivered.

Orchestration:

1. Preflight: inputs present.
2. `secret-remediation`: no findings → skipped.
3. Parallel dispatch:
   - `dependency-remediation`: CVE in deep-transitive `xml2js@0.4.23` via two parent deps neither of which have updated. Downgrade breaks prod feature. Action: exception with WAF rule blocking the attack vector + review date 2026-05-20.
   - `vulnerability-remediation`: no findings → skipped.
   - `container-remediation`: CVE is in `ubuntu:22.04` openssl; no patched tag yet. Action: exception with seccomp profile restricting syscalls + review date 2026-05-20 + vendor-tracker ticket OPS-412.
   - `compliance-remediation`: vendor SOC2 report gap. Action: escalate to procurement (TECH-901) with 30-day due date; document compensating control (vendor risk assessment interview + SIG questionnaire on file).
4. Re-scan:
   - Original findings still present (as expected — all deferred).
5. Residuals table:
   | ID | Class | Severity | Status | Owner | Review |
   |---|---|---|---|---|---|
   | CVE-2024-xxxx | dependency | HIGH | exception (WAF compensating) | @platform | 2026-05-20 |
   | CVE-2024-yyyy | container | HIGH | exception (seccomp compensating) | @platform | 2026-05-20 |
   | VENDOR-SOC2-Z | compliance | MEDIUM | follow-up TECH-901 | @procurement | 2026-05-20 |
6. Verdict: **FAIL** for release gate — 2 HIGH residuals exist. Escalate to CISO for sign-off before shipping, or reschedule release after vendor patches arrive.

## Constraints

- Never skip step 3 (secrets first). Running parallel remediations while credentials are still live compounds exposure risk.
- Never mark a residual "exception approved" without: business justification + compensating control + owner + review date. Missing any of these = ticket, not exception.
- Never ship the release if the orchestrator verdict is FAIL without explicit CISO / CTO override documented in the report.
- Never let an exception review date slip silently. Exceptions that pass their review date must be re-triaged or closed; re-file tickets proactively before the date.
- Do not treat "no findings after re-scan" as proof of remediation for compliance gaps — auditors want to see the policy / control / evidence artifact, not just scanner silence.

## Quality checks

- All 4 (or 5) per-class remediation reports are linked from the consolidated report.
- Delta counts in the executive summary are reproducible by re-running the scanners at the reported timestamp.
- Every residual has an unambiguous status — no "in-progress" rows left open.
- Every exception has a future review date ≤ 60 days; tickets exist for anything beyond that horizon.
- The pentest-report from the original audit has been updated with a link to this remediation cycle.
- Release-gate verdict (PASS / FAIL) is explicit and matches the residuals table.
