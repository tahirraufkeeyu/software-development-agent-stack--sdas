# Security Department

Security teams carry an asymmetric workload: one reviewer must understand many
codebases, many dependencies, and a moving threat landscape. Agent-assisted
audit and compliance flows let Claude Code drive the deterministic parts of
that workload (scanner orchestration, finding deduplication, evidence
collection, report assembly) so the engineer can focus on triage and
exploitation judgement.

This department packages that workflow into skills Claude can load on demand.
Each skill wraps real CLIs (ZAP, Semgrep, Gitleaks, Trivy, OSV-Scanner, ...)
with a deterministic procedure, known inputs/outputs, and tool dependencies.

## Skills

| Skill              | Description                                                                                                             | Complexity |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|------------|
| security-audit     | Orchestrates DAST + SAST + SCA scans, deduplicates findings, emits a combined severity-sorted report.                   | High       |
| secret-scanner     | Deep git history scan with Gitleaks and TruffleHog, allowlist diffing, remediation guidance (rotate then `git filter-repo`). | Medium |
| dependency-audit   | CVE scanning across npm/yarn/pnpm, pip/poetry, Go, Cargo, Maven/Gradle with CVSS and fix-version recommendations.       | Medium     |
| pentest-report     | Structured pentest report (exec summary, methodology, findings with CVSS/CWE/remediation, risk matrix, raw evidence).   | Medium     |
| container-scan     | Trivy image scan, secret-in-layer detection, distroless/non-root checks, Dockerfile best-practice validation.           | Medium     |
| compliance-check   | SOC 2 TSC (CC1-CC9) and ISO 27001 Annex A evidence collection, gap analysis, remediation ticket list.                   | High       |

## Quick install

```
./install.sh security
```

The installer copies the `skills/` tree into the active Claude Code skills
directory (`~/.claude/skills/` by default), makes the `*.sh` scripts
executable, and prints the list of detected external CLIs that still need
installation.

## Recommended MCP servers

- **filesystem MCP** — so Claude can read scanner output files
  (`semgrep.sarif`, `osv.json`, `trivy.json`, `gitleaks-report.json`) from the
  working directory without a shell round-trip.
- **GitHub MCP** — for pulling repo metadata, opening remediation issues,
  commenting on PRs, and attaching SARIF findings to a code-scanning alert
  stream.
- **Security scanners MCP (custom)** — a thin MCP wrapper around the scripts
  in `security-audit/scripts/` is recommended for shops that want scanner
  invocation decoupled from local shell access (e.g. a hardened CI runner).
  A reference implementation should expose `run_sast`, `run_dast`, `run_sca`,
  and `scan_container` tools.

## Recommended workflow

For a full audit pass, run the skills in this order:

1. `secret-scanner` — catch leaked credentials before any other tool consumes
   or publishes them. Rotate any hit before continuing.
2. `dependency-audit` — resolve transitive CVEs; often reduces the SAST/DAST
   noise that follows.
3. `security-audit` — orchestrates SAST + DAST + SCA and emits a combined
   markdown report in `./security-report.md`.
4. `pentest-report` — consumes the combined report plus any manual findings
   and produces a client-ready deliverable with CVSS/CWE per finding.

For release gating add `container-scan` after `dependency-audit` and before
publishing images. For audit season, run `compliance-check` quarterly and
store the evidence bundle in your GRC system.
