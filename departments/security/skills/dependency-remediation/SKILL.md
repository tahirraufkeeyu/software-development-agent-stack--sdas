---
name: dependency-remediation
description: Use when dependency-audit has produced CVE findings and you need to close them. Triages each finding into upgrade / transitive override / patch / replace / accept-with-mitigation, applies the fix per ecosystem (npm, pip, go, cargo, maven), verifies with tests, updates SBOM and lockfiles, and writes the audit trail.
safety: writes-shared
produces: security/remediation/dependencies-<date>.md
consumes:
  - security/findings/dependencies.json
---

## When to use

- `dependency-audit` has produced `security/findings/dependencies.json` and at least one finding is High severity or higher.
- A Dependabot / Renovate PR has stalled and you need a human-driven remediation pass.
- A vendor advisory (GHSA, CVE, ecosystem-specific) has been published affecting a direct or transitive dependency.
- A release is gated on closing CVEs above a configured severity threshold.

Do not use this skill to scan for vulnerabilities — that's `dependency-audit`. Do not use it for secret leaks in dependency manifests — that's `secret-remediation`.

## Inputs

- `security/findings/dependencies.json` from `dependency-audit`, or an equivalent CVE list.
- Write access to the repo (to change lockfiles and raise a PR).
- Local environment with the relevant package manager installed (`npm`, `poetry`, `go`, `cargo`, `mvn`).
- Optional: access to the SBOM store (e.g. `cyclonedx-cli` configured to publish).

## Outputs

- `security/remediation/dependencies-<date>.md` — per-CVE remediation audit trail.
- Updated lockfiles (`package-lock.json`, `poetry.lock`, `go.sum`, `Cargo.lock`, `pom.xml`).
- A PR with: CVEs closed, packages changed, test evidence, SBOM delta.
- For `accept-with-mitigation`: a documented exception with review date.

## Tool dependencies

- Package managers: `npm`, `yarn`, `pnpm`, `poetry`, `pip-tools`, `go`, `cargo`, `mvn`, `gradle`.
- Audit tools (to re-verify): `npm audit`, `osv-scanner`, `pip-audit`, `govulncheck`, `cargo-audit`.
- `cyclonedx-bom` or `syft` for SBOM regeneration.
- `jq` for parsing findings JSON.

## Procedure

1. **Triage findings into one of five buckets.** For each finding in `dependencies.json`:

   | Bucket | Criteria |
   |---|---|
   | Upgrade direct | Package is declared in the manifest + fix version exists. |
   | Transitive override | Package is a sub-dependency + fix version exists but parent hasn't updated. |
   | No patch — replace | No fix available + a maintained alternative exists with compatible API. |
   | No patch — accept | No fix, no alternative. Must justify with compensating control. |
   | False positive | CVE does not apply to our usage (e.g. server-only CVE in a build-time dep). |

2. **Upgrade direct** — run the canonical command per ecosystem:

   npm / yarn / pnpm:
   ```bash
   npm install lodash@^4.17.21
   # or:
   yarn upgrade lodash@^4.17.21
   # verify
   npm ls lodash
   npm audit --production
   ```

   pip / poetry:
   ```bash
   # poetry
   poetry add 'urllib3>=2.2.2'
   # or constrained pip-tools
   echo 'urllib3>=2.2.2' >> constraints.txt
   pip-compile --upgrade-package urllib3
   # verify
   pip-audit
   ```

   Go:
   ```bash
   go get github.com/gin-gonic/gin@v1.10.0
   go mod tidy
   govulncheck ./...
   ```

   Cargo:
   ```bash
   cargo update -p tokio --precise 1.38.0
   cargo audit
   ```

   Maven:
   ```xml
   <dependencyManagement>
     <dependencies>
       <dependency>
         <groupId>com.fasterxml.jackson.core</groupId>
         <artifactId>jackson-databind</artifactId>
         <version>2.17.1</version>
       </dependency>
     </dependencies>
   </dependencyManagement>
   ```
   Then `mvn dependency-check:check`.

3. **Transitive override** — force the sub-dependency version at the package manager level.

   npm (≥ 8.3):
   ```json
   {
     "overrides": {
       "minimist": "1.2.8"
     }
   }
   ```
   Then `npm install` and verify with `npm ls minimist` — every entry should be ≥ 1.2.8.

   yarn (Berry / classic 1.x):
   ```json
   {
     "resolutions": {
       "**/minimist": "1.2.8"
     }
   }
   ```

   pnpm:
   ```json
   {
     "pnpm": {
       "overrides": {
         "minimist": "1.2.8"
       }
     }
   }
   ```

   pip: add to `constraints.txt` and rebuild `requirements.txt` via `pip-compile --constraint constraints.txt`.

   Go: use `replace` in `go.mod`:
   ```go
   replace github.com/bad/transitive v1.0.0 => github.com/bad/transitive v1.0.3
   ```

   Cargo: `[patch.crates-io]` stanza in `Cargo.toml`.

4. **Replace** — when no patch and no parent update are viable, find a maintained alternative.
   - Check the ecosystem's maintenance signals: last-release date, open-issue count, download trend.
   - Confirm API compatibility or plan the migration (codemod script, compatibility shim).
   - Stage the replacement in a small PR with a before/after diff table.

5. **Test the upgrade.** Never ship a dependency bump without running:
   - Full unit test suite.
   - Integration tests that exercise the upgraded library (if no existing coverage, add a smoke test hitting the API path).
   - For major-version bumps, read the upgrade guide / changelog and `grep` the codebase for any deprecated API used.
   - For security-relevant changes (e.g. auth library), write an explicit regression test asserting the vulnerable behavior no longer occurs.

6. **Regenerate and commit the SBOM.**
   ```bash
   cyclonedx-bom -o sbom.json
   # or
   syft . -o cyclonedx-json > sbom.json
   git add sbom.json
   ```

7. **Open the PR** using this body template:
   ```markdown
   ## CVEs closed
   - CVE-2020-8203 (HIGH, CVSS 7.4) — lodash < 4.17.19

   ## Changes
   | Package | Before | After | Reason |
   |---|---|---|---|
   | lodash | 4.17.15 | 4.17.21 | direct upgrade |

   ## Test evidence
   - `npm test` — all 327 suites pass (https://ci…/run/1234).
   - Manual smoke test against `/api/orders` — pass.

   ## SBOM delta
   See `sbom.json` diff. 1 package updated, 0 added, 0 removed.
   ```

8. **Accept-with-mitigation requires explicit documentation.** If you cannot upgrade / override / replace:
   - Why not (date-bound reason, e.g. "vendor patch ETA 2026-05-15" or "blocks prod due to breaking change").
   - Compensating control (WAF rule, network isolation, feature flag, runtime patch such as aikido-zen / snyk runtime).
   - Review date (no more than 60 days away).
   - Owner.

9. **Write remediation report.** `security/remediation/dependencies-<date>.md` contains:
   - Summary: total CVEs in audit, closed / accepted / residual counts.
   - Per-CVE table: ID, severity, package, action taken, PR link, test evidence.
   - Exceptions register with review dates.
   - Re-audit result (ideally 0 matching the original CVE IDs).

## Examples

### Example 1 — direct upgrade with no breaking changes

`dependencies.json` excerpt:
```json
{
  "findings": [
    {
      "cve": "CVE-2020-8203",
      "severity": "HIGH",
      "cvss": 7.4,
      "package": "lodash",
      "version_current": "4.17.15",
      "version_fixed": "4.17.19",
      "direct": true
    }
  ]
}
```

Actions:
```bash
# 1. Upgrade
npm install lodash@^4.17.21     # pick the latest patched line
# 2. Check lockfile + test
npm ci
npm test                        # 327 pass
# 3. Regenerate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
# 4. Commit + PR
git add package.json package-lock.json sbom.json
git commit -m "chore(deps): upgrade lodash to 4.17.21 — closes CVE-2020-8203"
gh pr create --title "deps: close CVE-2020-8203 (lodash)" --body-file .github/pr-body-deps.md
# 5. Re-audit
npm audit --production
# found 0 vulnerabilities
```

Report excerpt:
```markdown
### CVE-2020-8203 — lodash prototype pollution
- Severity: HIGH (CVSS 7.4)
- Action: upgraded direct dependency `lodash` 4.17.15 → 4.17.21.
- Test evidence: `npm test` green (run 1234), smoke test on `/api/orders` pass.
- SBOM: 1 package updated.
- PR: #482, merged 2026-04-20T15:42Z.
```

### Example 2 — transitive override with follow-up reminder

`dependencies.json` excerpt:
```json
{
  "findings": [
    {
      "cve": "CVE-2021-44906",
      "severity": "HIGH",
      "cvss": 9.8,
      "package": "minimist",
      "version_current": "1.2.5",
      "version_fixed": "1.2.6",
      "direct": false,
      "depended_on_by": ["mkdirp@0.5.5"]
    }
  ]
}
```

`mkdirp@0.5.5` is a direct dependency; upgrading it to `0.5.6` pulls minimist ≥ 1.2.6 transitively. But we also have `mkdirp` pinned via legacy tooling. Use an override:

```json
{
  "overrides": {
    "minimist": "1.2.8"
  }
}
```

```bash
npm install
npm ls minimist
# └─┬ mkdirp@0.5.5
#   └── minimist@1.2.8    # override applied
npm test
npm audit --production    # CVE-2021-44906 no longer reported
```

Follow-up ticket (filed to tech-debt backlog): "Drop `overrides.minimist` once `mkdirp` is upgraded to ≥ 3.0 or replaced with `fs.mkdir({recursive: true})`." Owner: @platform. Review: 2026-06-20.

Report excerpt:
```markdown
### CVE-2021-44906 — minimist prototype pollution
- Severity: HIGH (CVSS 9.8)
- Action: transitive override via `overrides.minimist = "1.2.8"`.
- Verified: `npm ls minimist` shows 1.2.8 in every path.
- Follow-up: TECH-812 — drop override when mkdirp upgraded.
- Re-audit: CVE-2021-44906 not reported.
```

## Constraints

- Never merge a dependency PR without running the full test suite. A green single unit-test pass is insufficient.
- Never downgrade a package to escape a CVE — always prefer upgrade or override forward.
- Never leave `accept-with-mitigation` without a review date and owner.
- Never bulk-merge Dependabot PRs without re-running the audit against the merged result — Dependabot can close one CVE while introducing another.
- Do not open an override without a follow-up ticket to drop it when the parent updates. Overrides tend to survive forever if not tracked.

## Quality checks

- Re-run `dependency-audit` after changes → 0 findings for the CVE IDs in scope (or justified exceptions only).
- `npm ci` (or ecosystem equivalent) succeeds in a clean checkout with the new lockfile.
- Full test suite green on the remediation PR.
- SBOM has been regenerated and committed.
- Every exception in the report has an owner, a review date ≤ 60 days out, and a compensating control named.
