---
name: full-security-audit
description: Use when preparing for a release, a SOC2/PCI audit window, or any "sweep everything" security request. Chains secret-scanner, dependency-audit, security-audit, container-scan (if applicable), and pentest-report end-to-end and produces a single dated pentest report.
safety: writes-local
produces: security/reports/pentest-report-<date>.md
consumes:
  - security/findings/secrets.json
  - security/findings/dependencies.json
  - security/findings/audit.json
  - security/findings/container.json
chains:
  - secret-scanner
  - dependency-audit
  - security-audit
  - container-scan
  - pentest-report
---

## When to use

- Preparing for a release cut, external pentest, customer security questionnaire, or audit window (SOC2, ISO 27001, PCI).
- User says "run the full security sweep", "pre-release security check", "give me the pentest report", or "what's our security posture".
- Onboarding a new repository and establishing a baseline.
- Post-incident hardening where the team wants confirmation that no related findings remain.

Do not use this for a single-file review (use `code-review`) or for runtime incident triage (use `incident-response`). Do not use this as a substitute for a third-party pentest — this orchestrator produces internal evidence, not an attestation.

## Chained skills

1. secret-scanner — runs a deep sweep of the working tree and full git history for leaked credentials, writes findings to `security/findings/secrets.json`.
2. dependency-audit — enumerates every manifest (`package-lock.json`, `poetry.lock`, `Gemfile.lock`, `go.sum`, `Cargo.lock`, `requirements.txt`) and produces CVE findings in `security/findings/dependencies.json`.
3. security-audit — combined SAST + DAST + SCA pass, writes findings to `security/findings/audit.json`.
4. container-scan — scans built images and their base layers; only runs if a `Dockerfile` (or `Containerfile`) is present. Writes `security/findings/container.json`.
5. pentest-report — consumes all four JSON artifacts and produces a formal, dated report suitable for leadership or an external auditor.

## Inputs

- Repository root (the working directory; default cwd).
- Optional: a released/candidate image reference (`ghcr.io/acme/api:1.4.0`) to scan instead of building from `Dockerfile`.
- Optional: a target environment URL if DAST should hit a staging deploy (`https://staging.acme.io`).
- Optional: a severity floor for the final report (defaults to `medium`; findings below are listed but not counted toward overall risk).

## Outputs

- `security/findings/secrets.json` — raw secret-scanner output.
- `security/findings/dependencies.json` — raw dependency-audit output.
- `security/findings/audit.json` — raw security-audit output.
- `security/findings/container.json` — raw container-scan output (only if Dockerfile present).
- `security/reports/pentest-report-<YYYY-MM-DD>.md` — consolidated report with Executive Summary, Scope, Methodology, Findings (grouped by severity), Remediation Plan, and Appendices linking each raw JSON.

## Tool dependencies

- Bash.
- `gitleaks` (secret-scanner) — `gitleaks detect --source . --redact --report-format json --report-path security/findings/secrets.json --log-opts="--all"`.
- `osv-scanner` or `npm audit` / `pip-audit` / `bundle audit` / `govulncheck` / `cargo audit` (dependency-audit).
- `semgrep` (SAST) — `semgrep ci --json --output security/findings/audit.json`.
- `zap-cli` or `nuclei` (DAST, optional; only if a target URL is provided).
- `trivy` (container-scan) — `trivy image --format json --output security/findings/container.json <image>`.
- `jq` for merging the JSON artifacts before invoking pentest-report.

## Procedure

1. Ensure output directories exist: `mkdir -p security/findings security/reports`.
2. Run `secret-scanner`. Shell: `gitleaks detect --source . --redact --report-format json --report-path security/findings/secrets.json --log-opts="--all"`. Parse the JSON and count entries with `Severity == "HIGH"` (or equivalent provider classification).
3. **Halt gate.** If secret-scanner reports any unresolved HIGH finding (e.g. live AWS key, Stripe live key, GitHub PAT), stop immediately. Do not run the other scans. Write a truncated `security/reports/pentest-report-<date>.md` containing only the Executive Summary with `Overall Risk: Critical` and a remediation block that tells the user to rotate the credential first, then purge with `git filter-repo` or `bfg`, then re-run. Rationale: scanning further while a live key is exposed wastes time and can leak the key into more artifacts.
4. Run `dependency-audit`. Detect the package manager(s) and run the appropriate command(s) in parallel:
   - Node: `npx osv-scanner --lockfile=package-lock.json --format json > security/findings/dependencies.json`.
   - Python: `pip-audit -r requirements.txt -f json -o security/findings/dependencies.json`.
   - Go: `govulncheck -json ./... > security/findings/dependencies.json`.
   - Ruby: `bundle audit check --update --format json > security/findings/dependencies.json`.
   - Rust: `cargo audit --json > security/findings/dependencies.json`.
   If multiple managers exist, run each and merge with `jq -s 'add' a.json b.json > security/findings/dependencies.json`.
5. Run `security-audit`. Shell: `semgrep ci --json --output security/findings/audit.json --config p/owasp-top-ten --config p/security-audit`. If a staging URL was provided, append a DAST pass via `nuclei -u <url> -severity medium,high,critical -json -o /tmp/nuclei.json` and merge into `audit.json`.
6. Detect a Dockerfile: `test -f Dockerfile || test -f Containerfile`. If present, run `container-scan`:
   - Build or pull the image: `docker build -t sdas-scan:latest .` (or use the user-supplied reference).
   - `trivy image --severity MEDIUM,HIGH,CRITICAL --format json --output security/findings/container.json sdas-scan:latest`.
   If no Dockerfile and no image reference, skip this step and record `container-scan: skipped (no Dockerfile)` in the report's Scope section.
7. Invoke `pentest-report`. Pass all four (or three) JSON paths. It must write to `security/reports/pentest-report-$(date +%Y-%m-%d).md`.
8. Verify the report exists, is non-empty, and references each raw JSON artifact by path in its Appendix.

## Examples

### Example 1 — clean sweep (Node.js/Express API)

Repo: `acme-api` (Express + TypeScript, Dockerfile present, staging at `https://staging.acme.io`).

Step 2 — secret-scanner:

```
$ gitleaks detect --source . --redact --report-format json --report-path security/findings/secrets.json --log-opts="--all"
INFO 12 commits scanned, 0 leaks found
```

`security/findings/secrets.json`:

```json
[]
```

No HIGH findings — proceed.

Step 4 — dependency-audit finds 2 medium CVEs:

```json
[
  {"id": "GHSA-8jfx-rwrr-rqjc", "package": "express", "severity": "MEDIUM", "fixed": "4.19.2"},
  {"id": "GHSA-h6ch-v84p-w6p9", "package": "semver",  "severity": "MEDIUM", "fixed": "7.5.4"}
]
```

Step 5 — security-audit (semgrep) finds 1 medium SAST finding:

```json
[
  {"rule": "javascript.express.security.audit.missing-rate-limit",
   "severity": "MEDIUM", "path": "src/routes/login.ts", "line": 22,
   "message": "POST /login has no rate limit"}
]
```

Step 6 — trivy reports 0 high/critical OS-package CVEs in the image.

Step 7 — `pentest-report` writes `security/reports/pentest-report-2026-04-19.md` (excerpt):

```markdown
# Pentest Report — acme-api — 2026-04-19

## Executive Summary
Overall Risk: Medium
Scope: 1 repository, 1 container image, 1 staging URL.
Findings: 3 (0 critical, 0 high, 3 medium, 0 low).
Posture: safe to release after the 3 medium items are scheduled.

## Findings
### Medium
1. GHSA-8jfx-rwrr-rqjc — express < 4.19.2 — upgrade to 4.19.2.
2. GHSA-h6ch-v84p-w6p9 — semver < 7.5.4  — upgrade to 7.5.4.
3. Missing rate limit on POST /login (src/routes/login.ts:22) — add express-rate-limit with 10 req/min per IP.

## Appendix
- security/findings/secrets.json
- security/findings/dependencies.json
- security/findings/audit.json
- security/findings/container.json
```

### Example 2 — halt path (leaked AWS key)

Repo: `acme-payments` (Python/FastAPI).

Step 2 — secret-scanner:

```
$ gitleaks detect --source . --redact --report-format json --report-path security/findings/secrets.json --log-opts="--all"
WARN leaks found: 1
```

`security/findings/secrets.json`:

```json
[
  {
    "RuleID": "aws-access-token",
    "Severity": "HIGH",
    "File": "scripts/bootstrap.sh",
    "Commit": "9f2c1ab",
    "Author": "alice@acme.io",
    "Date": "2025-11-03T14:12:55Z",
    "Match": "AKIA****************",
    "Entropy": 4.2
  }
]
```

Step 3 — **halt**. Orchestrator does NOT run dependency-audit, security-audit, or container-scan. It writes a truncated `security/reports/pentest-report-2026-04-19.md`:

```markdown
# Pentest Report — acme-payments — 2026-04-19

## Executive Summary
Overall Risk: Critical — scan halted at step 1.

A live AWS access token was found in git history:
  File:   scripts/bootstrap.sh
  Commit: 9f2c1ab (alice@acme.io, 2025-11-03)
  Prefix: AKIA****************

## Required Remediation (in order)
1. Rotate the key in the AWS console NOW. Assume it is compromised.
2. Confirm rotation by checking CloudTrail for unexpected `AssumeRole` / `GetCallerIdentity` calls since 2025-11-03.
3. Purge from history:
     git filter-repo --path scripts/bootstrap.sh --invert-paths
     git push --force-with-lease origin main
4. Notify all clones to re-fetch. Revoke any long-lived branches.
5. Re-run `full-security-audit`. Subsequent steps (dependency-audit, security-audit, container-scan, pentest-report) will execute once secrets.json is clean.

## Appendix
- security/findings/secrets.json
```

No other JSON artifacts exist yet; the remaining chained skills are not invoked.

## Constraints

- Do not skip the halt gate after secret-scanner. A live credential is a stop-the-world event; continuing the sweep can exfiltrate the key into CI logs, artifact stores, or a SaaS scanner.
- Do not skip a step on failure. If `semgrep` exits non-zero for reasons other than findings (e.g. config error), surface the error and halt — do not substitute a partial result.
- Do not modify source code. This orchestrator is read-only on the repo tree; it writes only into `security/findings/` and `security/reports/`.
- Do not upload findings anywhere. All artifacts stay local.
- Do not redact severities in the final report. Raw severity labels from each tool are preserved verbatim.
- Do not run `container-scan` if no Dockerfile and no image reference are available — record the skip explicitly instead of fabricating a result.
- Do not overwrite a prior dated report. If `security/reports/pentest-report-<date>.md` already exists, append a suffix (`-2`, `-3`) so historical reports are preserved.
- Do not invoke `pentest-report` until every preceding JSON artifact exists and parses as valid JSON (`jq . <file> > /dev/null`).

## Quality checks

- Every referenced JSON file exists, is valid JSON, and is non-empty (empty array `[]` is valid and means "no findings").
- `security/reports/pentest-report-<date>.md` exists, is > 1 KB for a clean sweep, and contains the five required sections: Executive Summary, Scope, Methodology, Findings, Appendix.
- Each finding in the final report maps back to a specific entry in one of the raw JSON files (verify by `jq` id lookup).
- When the halt gate fires, only `secrets.json` exists under `security/findings/` and the report's Executive Summary contains the string `Overall Risk: Critical`.
- `Overall Risk` in the Executive Summary is computed consistently: `Critical` if any critical finding; else `High` if any high; else `Medium` if any medium; else `Low`.
- Container-scan is either present with a valid `container.json` or explicitly marked `skipped (no Dockerfile)` in the Scope section — never silently missing.
- Re-running the orchestrator on the same tree produces a new dated report (or suffixed variant) without mutating prior reports.
