---
name: dependency-audit
description: Use when the user asks to "audit dependencies", "check for CVEs", or before a release. Runs CVE scanning across every detected package manager (npm/yarn/pnpm, pip/poetry, Go modules, Cargo, Maven/Gradle), produces CVSS-scored findings with fix-version recommendations and explicit flags for transitive dependencies.
safety: safe
---

## When to use

Trigger when:

- "Audit our dependencies" / "any CVEs in prod?" / "is log4shell present".
- Renovate / Dependabot fatigue — user wants a single prioritized list.
- Pre-release gate: block shipping on Critical CVEs in direct deps.
- Incident: a new CVE was just published, "are we vulnerable".

Do not use for SAST (use `security-audit`) or container layer CVEs (use
`container-scan`).

## Inputs

- `REPO_PATH` (default: `.`) — source tree to audit.
- `OUT_DIR` (default: `./dep-audit-out`).
- `MIN_SEVERITY` (default: `MEDIUM`) — filter floor.
- `INCLUDE_DEV` (default: `0`) — include dev-only deps.
- `FAIL_ON` (default: `CRITICAL`) — exit-code gate severity.
- Optional env:
  - `GITHUB_TOKEN` — raises GitHub Advisory rate limits.
  - `OSV_API_URL` — override osv.dev endpoint (for air-gapped).

## Outputs

- Per-ecosystem raw: `osv.json`, `npm-audit.json`, `pip-audit.json`,
  `govulncheck.json`, `cargo-audit.json`, `dependency-check.json`.
- `dep-audit.normalized.json` — unified records.
- `dep-audit-report.md` — grouped-by-severity report with fix table.

Unified record:
```
{
  "ecosystem": "npm",
  "package": "lodash",
  "installed_version": "4.17.20",
  "path": ["@my/app", "express-session", "lodash"],
  "direct": false,
  "cve": ["CVE-2021-23337"],
  "ghsa": "GHSA-35jh-r3h4-6jhm",
  "cvss": 7.2,
  "severity": "high",
  "summary": "Command Injection in lodash",
  "fixed_in": "4.17.21",
  "fix_kind": "patch",
  "references": ["https://nvd.nist.gov/vuln/detail/CVE-2021-23337"]
}
```

## Tool dependencies

- `osv-scanner` >= 1.7 (universal, required).
- Ecosystem tools (optional, each enables a manifest type):
  - `npm` / `yarn` / `pnpm` for JS.
  - `pip-audit` for Python.
  - `govulncheck` for Go.
  - `cargo-audit` for Rust.
  - OWASP `dependency-check` for Maven/Gradle.
- `jq`.

## Procedure

1. Detect manifests. Presence rules:
   - `package.json` + lockfile (`package-lock.json`, `yarn.lock`,
     `pnpm-lock.yaml`) -> JS.
   - `requirements.txt`, `pyproject.toml`, `Pipfile.lock` -> Python.
   - `go.mod` -> Go.
   - `Cargo.lock` -> Rust.
   - `pom.xml`, `build.gradle*` -> JVM.
2. Run `../security-audit/scripts/run-sca.sh "$REPO_PATH" "$OUT_DIR"` —
   it already knows how to dispatch per ecosystem.
3. Normalize each raw output into the unified schema. Key steps:
   - OSV -> one record per
     `results[].packages[].vulnerabilities[]`.
   - npm-audit v2 -> walk `vulnerabilities` map; `direct: true` if
     `via[].dependency == <root>`.
   - pip-audit -> `dependencies[].vulns[]`.
   - govulncheck -> records where `finding.osv != null` and the trace
     reaches `internal/functions` (callable, not just imported).
   - cargo-audit -> `vulnerabilities.list[]`.
4. Build dependency path for each transitive finding using the lockfile
   (`npm ls <pkg> --json`, `pip show`, `go mod graph`,
   `cargo tree -i <pkg>`). Populate `path` and `direct`.
5. Compute CVSS: prefer NVD `cvssMetricV31.baseScore`; fall back to GHSA
   severity string -> numeric midpoint (Low=2, Medium=5, High=8, Critical=9.5).
6. Filter below `$MIN_SEVERITY`.
7. Produce `dep-audit-report.md`:
   - Section per severity.
   - Table columns: `Package | Installed | Fixed in | CVE | Severity |
     Direct/Transitive | Path`.
   - "Fix plan" section with a concrete upgrade command per ecosystem
     (e.g. `npm install lodash@4.17.21`, `poetry add cryptography@^42.0.5`,
     `go get golang.org/x/crypto@v0.21.0`).
8. Exit non-zero if any finding has severity >= `$FAIL_ON`.

## Examples

### Example 1 — multi-language monorepo

```
REPO_PATH=$PWD OUT_DIR=./out MIN_SEVERITY=HIGH ./run-audit.sh
```

Expected `dep-audit-report.md` snippet:

```
## Critical (1)

| Package | Installed | Fixed in | CVE            | Direct | Path                               |
|---------|-----------|----------|----------------|--------|------------------------------------|
| log4j   | 2.14.1    | 2.17.1   | CVE-2021-44228 | no     | app -> spring-boot-starter -> log4j |

Fix plan:
- Gradle:  implementation 'org.apache.logging.log4j:log4j-core:2.17.1'
- Maven:   <dependency>...<version>2.17.1</version></dependency>
- Confirm transitive pin with `./gradlew dependencies | grep log4j-core`
```

### Example 2 — JS-only, include dev deps

```
REPO_PATH=./frontend INCLUDE_DEV=1 MIN_SEVERITY=MEDIUM \
    ./run-audit.sh
```

Expected log excerpt:

```
[dep-audit] detected: package.json, pnpm-lock.yaml
[dep-audit] running: pnpm audit --json
[dep-audit] running: osv-scanner -r ./frontend
[dep-audit] findings: 3 high, 12 medium (2 direct, 13 transitive)
[dep-audit] wrote ./dep-audit-report.md (exit 2: High findings present)
```

## Constraints

- Never auto-bump a dependency. The skill reports — the human upgrades.
- Never trust the `severity` string from a single source. Cross-check
  osv.dev and GHSA when both are available; pick the higher.
- Treat "unfixed" CVEs (no `fixed_in`) as at least High regardless of
  base CVSS; record `fix_kind: "no fix available — mitigate"` and prompt
  for a compensating control.
- Respect `.osv-scanner.toml` ignores but surface them in the report under
  "Known accepted risks" — do not silently drop.
- If a transitive can't be resolved via a direct override (lockfile pin),
  flag `fix_kind: "requires upstream fix"` so the human doesn't chase it.

## Quality checks

- [ ] Every record has either `cve` or `ghsa` — never both empty.
- [ ] `direct` is boolean and consistent with `path[0] == root_package`.
- [ ] Fix-plan commands are syntactically valid for the ecosystem.
- [ ] No Critical was silently filtered by `$MIN_SEVERITY`.
- [ ] Report includes an "Accepted risks" section listing every allowlist
      hit with its justification reference.
