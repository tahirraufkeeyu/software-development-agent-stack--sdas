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

The department ships skills in two halves: **scan / report** skills that find problems, and **remediation** skills that close them. Each scanner pairs with a remediation skill consuming the same findings JSON so closure is traceable end-to-end.

### Scan and report

| Skill              | Description                                                                                                             | Complexity |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|------------|
| [security-audit](skills/security-audit/SKILL.md)     | Orchestrates DAST + SAST + SCA scans, deduplicates findings, emits a combined severity-sorted report.                   | High       |
| [secret-scanner](skills/secret-scanner/SKILL.md)     | Deep git history scan with Gitleaks and TruffleHog, allowlist diffing, remediation guidance (rotate then `git filter-repo`). | Medium |
| [dependency-audit](skills/dependency-audit/SKILL.md)   | CVE scanning across npm/yarn/pnpm, pip/poetry, Go, Cargo, Maven/Gradle with CVSS and fix-version recommendations.       | Medium     |
| [pentest-report](skills/pentest-report/SKILL.md)     | Structured pentest report (exec summary, methodology, findings with CVSS/CWE/remediation, risk matrix, raw evidence).   | Medium     |
| [container-scan](skills/container-scan/SKILL.md)     | Trivy image scan, secret-in-layer detection, distroless/non-root checks, Dockerfile best-practice validation.           | Medium     |
| [compliance-check](skills/compliance-check/SKILL.md)   | SOC 2 TSC (CC1-CC9) and ISO 27001 Annex A evidence collection, gap analysis, remediation ticket list.                   | High       |

### Remediation

| Skill                        | Pairs with        | Description                                                                                                            | Complexity |
|------------------------------|-------------------|------------------------------------------------------------------------------------------------------------------------|------------|
| [secret-remediation](skills/secret-remediation/SKILL.md)           | secret-scanner    | Rotate credentials at the provider, invalidate old keys, `git filter-repo` history rewrite, install prevention (pre-commit, CI, secret manager). | High |
| [dependency-remediation](skills/dependency-remediation/SKILL.md)       | dependency-audit  | Upgrade / override / replace vulnerable packages per ecosystem (npm, pip, go, cargo, maven), regenerate SBOM, open PR with test evidence. | Medium |
| [vulnerability-remediation](skills/vulnerability-remediation/SKILL.md)    | security-audit    | Fix SAST/DAST findings with category-specific patterns (injection, XSS, authz, crypto, misconfig). Add a regression test per finding and re-run the scanner rule to verify. | High |
| [container-remediation](skills/container-remediation/SKILL.md)        | container-scan    | Rebase image to patched / distroless base, multi-stage + non-root Dockerfile, BuildKit secret mounts, rebuild from scratch, re-scan with Trivy. | Medium |
| [compliance-remediation](skills/compliance-remediation/SKILL.md)       | compliance-check  | Close Design / Operating / Evidence gaps — draft policies, configure controls (IAM, SSO, monitoring), set up evidence-locker pipelines with test-of-effectiveness docs. | High |

## Workflow orchestrators

This department ships **two workflow orchestrators**. Orchestrators have a richer frontmatter (`chains`, `produces`, `consumes`) and are invoked the same way as any other skill.

| Orchestrator | Chains | One-line purpose |
| --- | --- | --- |
| [full-security-audit](skills/full-security-audit/SKILL.md) | secret-scanner, dependency-audit, security-audit, container-scan, pentest-report | Complete release-gate sweep: secrets, CVEs, SAST/DAST/SCA, container images, and a consolidated pentest report. |
| [full-security-remediation](skills/full-security-remediation/SKILL.md) | secret-remediation, dependency-remediation, vulnerability-remediation, container-remediation, compliance-remediation | End-to-end remediation cycle: dispatch each finding class to its remediation skill (secrets first, rest in parallel), re-run scanners to verify closure, and produce a consolidated before/after report with a PASS/FAIL release-gate verdict. |

## Quick install

```bash
skillskit install security
```

The installer copies the `skills/` tree into the active Claude Code skills
directory (`~/.claude/skills/` by default), makes the `*.sh` scripts
executable, and prints the list of detected external CLIs that still need
installation.

Don't have the CLI yet? Install it with `brew install tahirraufkeeyu/tap/skillskit` (macOS/Linux) or `scoop install tahirraufkeeyu/scoop-bucket/skillskit` (Windows). See [skillskit.dev](https://skillskit.dev/#install) for alternative installers.

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

## Recommended workflows

### Audit pass (scan only)

For a pre-release audit sweep without remediation, run:

1. `secret-scanner` — catch leaked credentials before any other tool consumes or publishes them. Rotate any hit before continuing.
2. `dependency-audit` — resolve transitive CVEs; often reduces the SAST/DAST noise that follows.
3. `security-audit` — orchestrates SAST + DAST + SCA and emits a combined markdown report in `./security-report.md`.
4. `pentest-report` — consumes the combined report plus any manual findings and produces a client-ready deliverable with CVSS/CWE per finding.

Or invoke `full-security-audit` to run the whole chain in one step.

For release gating add `container-scan` after `dependency-audit` and before publishing images. For audit season, run `compliance-check` quarterly and store the evidence bundle in your GRC system.

### Audit + remediation pass (scan → fix → re-scan)

When you want closure, not just findings:

1. `full-security-audit` — scan everything, produce the 5 findings JSONs.
2. `full-security-remediation` — rotate secrets first, dispatch the remaining remediations in parallel, re-run each scanner to verify closure, produce the consolidated before/after report.

The remediation orchestrator halts on secret-rotation failure (credentials must be invalidated before anything else touches git or rebuilds images) and issues a PASS / FAIL release-gate verdict based on residual HIGH+ findings. FAIL requires an explicit override documented in the report.

### Pairwise remediation (single finding class)

If you only need one remediation flow — e.g. closing a Dependabot alert — invoke the single remediation skill directly rather than the full orchestrator:

- `secret-remediation` after `secret-scanner`
- `dependency-remediation` after `dependency-audit`
- `vulnerability-remediation` after `security-audit`
- `container-remediation` after `container-scan`
- `compliance-remediation` after `compliance-check`
