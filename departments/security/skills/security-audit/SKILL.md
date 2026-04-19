---
name: security-audit
description: Use when the user asks for a full security audit, pre-release security gate, or "scan this repo / service end-to-end". Orchestrates DAST (ZAP, Nuclei, Wapiti), SAST (Semgrep, SonarQube), and SCA (OSV-Scanner, npm audit, pip-audit, govulncheck, cargo-audit), deduplicates findings, classifies by severity, and emits a combined markdown report.
safety: writes-local
---

## When to use

Invoke this skill when any of the following apply:

- User requests "security audit", "pre-release security review", or "scan repo X".
- A target URL is available and the user wants dynamic + static + dependency
  coverage in one pass.
- A CI job needs a single command that produces a SARIF + JSON + markdown
  deliverable.

Do not use for a secrets-only sweep (use `secret-scanner`) or a container
image review (use `container-scan`). For a client-ready pentest deliverable,
chain this skill into `pentest-report`.

## Inputs

- `REPO_PATH` (default: `.`) — absolute path to the source tree to scan.
- `TARGET_URL` (required for DAST) — base URL of the running application,
  e.g. `https://staging.example.com`.
- `OUT_DIR` (default: `./security-audit-out`) — where scanner artifacts and
  the combined report are written.
- Optional env:
  - `SONAR_HOST_URL`, `SONAR_TOKEN` — enables SonarScanner in `run-sast.sh`.
  - `ZAP_AUTH_HEADER` — forwarded to the ZAP baseline scan.
  - `SEVERITY_FLOOR` (default: `medium`) — drop findings below this in the
    combined report.

## Outputs

All paths relative to `$OUT_DIR`:

- `semgrep.sarif`, `sonar-report.json` (SAST)
- `zap-baseline.json`, `nuclei.json`, `wapiti.json` (DAST)
- `osv.json`, `npm-audit.json`, `pip-audit.json`, `govulncheck.json`,
  `cargo-audit.json` (SCA, whichever apply)
- `findings.normalized.json` — deduplicated, severity-classified unified
  finding list.
- `security-report.md` — human-readable combined report (executive summary,
  findings by severity, fix guidance, raw-evidence pointers).

## Tool dependencies

- `bash` >= 4, `jq` >= 1.6, `docker` (for ZAP baseline), `python3`.
- Scanners invoked by the scripts: `semgrep`, `sonar-scanner` (optional),
  `owasp/zap2docker-stable` image, `nuclei`, `wapiti` (optional),
  `osv-scanner`, `npm`, `pip-audit`, `govulncheck`, `cargo-audit`.
- See `references/severity-thresholds.md` for SLA mapping and
  `references/owasp-top10-checks.md` for the OWASP A01-A10 check set.

## Procedure

1. Resolve inputs. Require `TARGET_URL` when DAST is requested; warn and
   continue SAST+SCA only if absent.
2. `mkdir -p "$OUT_DIR"` and `cd "$REPO_PATH"`.
3. Run SCA first — cheapest, loudest:
   `scripts/run-sca.sh "$REPO_PATH" "$OUT_DIR"`.
4. Run SAST:
   `scripts/run-sast.sh "$REPO_PATH" "$OUT_DIR"`.
5. Run DAST (only if `TARGET_URL` set):
   `scripts/run-dast.sh "$TARGET_URL" "$OUT_DIR"`.
6. Normalize and deduplicate. For each scanner output build a record of
   `{tool, rule_id, severity, cwe, file/url, line, message, evidence_path}`
   then dedupe by `(rule_id or cwe, file+line or url+param)` keeping the
   highest severity.
7. Classify severity using `references/severity-thresholds.md` (CVSS 3.1
   buckets: Critical >= 9.0, High 7.0-8.9, Medium 4.0-6.9, Low 0.1-3.9).
8. Drop findings below `$SEVERITY_FLOOR` from the report but keep them in
   `findings.normalized.json`.
9. Emit `security-report.md`:
   - Executive summary (counts per severity, top 5 risks).
   - Findings grouped by severity, each with fix guidance and evidence
     pointer.
   - Appendix linking each raw artifact.
10. Exit non-zero if any Critical remains (CI gate).

## Examples

### Example 1 — local repo + staging URL

```
REPO_PATH=/src/checkout \
TARGET_URL=https://staging.checkout.example.com \
OUT_DIR=/tmp/audit-checkout \
SEVERITY_FLOOR=medium \
./scripts/run-sca.sh  /src/checkout /tmp/audit-checkout
./scripts/run-sast.sh /src/checkout /tmp/audit-checkout
./scripts/run-dast.sh https://staging.checkout.example.com /tmp/audit-checkout
```

Expected tail of `security-report.md`:

```
## Summary
- Critical: 1
- High:     4
- Medium:  17
- Low:     32

## Critical findings
### CVE-2024-21626 — runc file descriptor leak (container escape)
- Source: osv-scanner (dependency: runc@1.1.9)
- CVSS 3.1: 8.6 (High base, Critical in privileged-container context)
- Fix: upgrade runc to >= 1.1.12. Rebuild base image.
- Evidence: /tmp/audit-checkout/osv.json#/results/2
```

### Example 2 — SAST + SCA only (no running target)

```
REPO_PATH=. OUT_DIR=./out ./scripts/run-sca.sh  . ./out
REPO_PATH=. OUT_DIR=./out ./scripts/run-sast.sh . ./out
```

Expected: `./out/semgrep.sarif`, `./out/osv.json`, `./out/findings.normalized.json`,
`./out/security-report.md` (DAST section marked "skipped — no TARGET_URL").

## Constraints

- Never run DAST against production without explicit user confirmation in
  the conversation; `TARGET_URL` pointing at a known prod domain must be
  challenged.
- Never upload artifacts off-box. All outputs stay under `$OUT_DIR`.
- Do not mutate source files. The audit is read-only.
- Keep scanner versions pinned in `run-*.sh`; do not auto-upgrade in CI.
- Report must cite CVE/CWE IDs when available — never fabricate identifiers.

## Quality checks

- [ ] `findings.normalized.json` validates against the documented schema
      (array of objects with `tool`, `severity`, `rule_id`).
- [ ] Every finding in `security-report.md` has an evidence pointer that
      resolves to a real file+offset under `$OUT_DIR`.
- [ ] No two findings share the same `(rule_id, location)` after dedupe.
- [ ] Exit code is non-zero iff at least one Critical is present.
- [ ] All three scripts ran or were explicitly skipped with a logged reason.
