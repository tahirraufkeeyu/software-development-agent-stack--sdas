---
name: full-regression
description: Use when preparing a release build for production and a complete pre-release QA sweep is required. Orchestrates API, E2E, performance, and accessibility testing, then consolidates results into a single release-readiness report with a go/no-go recommendation.
safety: writes-local
produces: qa/reports/release-readiness-<release>.md
consumes:
  - qa/fixtures/test-data.json
  - qa/results/api.json
  - qa/results/e2e.json
  - qa/results/perf.json
  - qa/results/a11y.json
chains:
  - test-data-generator
  - api-test-generator
  - e2e-test-generator
  - performance-test
  - accessibility-audit
  - bug-report
---

## When to use

Invoke this orchestrator when any of the following hold:

- A release candidate (tag, RC branch, or staging deploy) needs sign-off before promotion to production.
- A risk-significant change landed (schema migration, auth rework, checkout flow, pricing, payments) and the team wants a full sweep rather than targeted tests.
- The release train runs on a schedule (weekly, biweekly) and this is the pre-cut checkpoint.
- A previous release was rolled back and leadership wants a reproducible quality gate.

Do not use for per-commit CI — this is heavier than PR-level gates. For a PR check, invoke the individual skills directly.

## Chained skills

This orchestrator composes six existing QA skills in a fixed order. Each downstream skill consumes the artifacts of the previous one. Failure in any step does not abort the run — results are collected and summarized so the reviewer sees the full picture.

1. `test-data-generator` — produces a deterministic fixture set so every test run is reproducible.
2. `api-test-generator` — Schemathesis-driven property tests against the OpenAPI spec; fastest feedback first.
3. `e2e-test-generator` — Playwright or Cypress tests running against the staging URL.
4. `performance-test` — Lighthouse + Chrome DevTools traces for Core Web Vitals on the top 5 most-visited pages.
5. `accessibility-audit` — axe-core + manual-checklist pass for WCAG 2.1 AA on the same pages as performance.
6. `bug-report` — invoked once per FAIL-severity finding; drafts ticket-ready bug reports with repro steps, screenshots, and logs.

## Inputs

- `release` — release identifier (e.g. `2026.04.2`, `v3.14.0`). Used in filenames and the report header.
- `staging_url` — base URL for E2E, performance, and a11y (e.g. `https://staging.example.com`).
- `openapi_spec_path` — local path or URL to the OpenAPI document Schemathesis will fuzz.
- `top_pages` — array of 5 path strings for perf + a11y (e.g. `["/", "/catalog", "/product/sample", "/cart", "/checkout"]`). Source from analytics; fall back to ICP-critical flows if analytics is unavailable.
- `thresholds` (optional) — overrides for pass/fail gates. Defaults: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, 0 WCAG AA violations, 0 API 5xx on valid inputs.

## Outputs

- `qa/reports/release-readiness-<release>.md` — primary artifact. Summary table (API / E2E / Perf / A11y / Blockers), go/no-go recommendation, links to every downstream artifact, and a condensed findings list.
- `qa/fixtures/test-data.json` — deterministic seed data from step 1.
- `qa/results/api.json`, `qa/results/e2e.json`, `qa/results/perf.json`, `qa/results/a11y.json` — raw results per stage.
- `qa/bugs/BUG-<date>-NN.md` — one file per FAIL finding routed through `bug-report`.

## Tool dependencies

- Node 20+ with `npx` (Playwright, Lighthouse).
- Python 3.11+ with `schemathesis` installed.
- `@axe-core/cli` or `axe-playwright` for accessibility.
- `lighthouse` CLI or Chrome DevTools MCP for Core Web Vitals.
- Network access to the staging URL and any OpenAPI spec endpoint.
- Write access to `qa/` under the repo root.

## Procedure

1. **Preflight.** Verify the staging URL returns 200 for `/healthz` (or `/`), the OpenAPI spec parses, and `qa/` exists. If any preflight fails, stop and return the specific failure.

2. **Seed test data.** Invoke `test-data-generator` with the release identifier. Expect `qa/fixtures/test-data.json`. If the generator fails, abort — nothing downstream is trustworthy without deterministic data.

3. **API tests (fastest feedback).** Invoke `api-test-generator`. It runs Schemathesis against `openapi_spec_path` using the seeded data. Example command the skill emits:
   ```
   schemathesis run <openapi_spec_path> \
     --base-url <staging_url> \
     --checks all \
     --hypothesis-seed 20260419 \
     --report qa/results/api.json
   ```
   Collect the JSON. Treat any 5xx on valid inputs, schema mismatch, or auth regression as FAIL.

4. **E2E tests.** Invoke `e2e-test-generator`. It runs Playwright (preferred) against `staging_url` using the seeded accounts. Example:
   ```
   npx playwright test --reporter=json > qa/results/e2e.json
   ```
   Treat any failing spec as FAIL. Flaky specs (rerun-pass) are WARN, not FAIL, but must appear in the report.

5. **Performance audit.** Invoke `performance-test` for each of the 5 `top_pages`. It runs Lighthouse with a mobile 4G preset plus a Chrome DevTools trace. Gate on LCP, INP, CLS per `thresholds`. Write `qa/results/perf.json` with the per-page scores and a reference to each trace file.

6. **Accessibility audit.** Invoke `accessibility-audit` on the same 5 pages. WCAG 2.1 AA via axe-core. Any violation of impact `serious` or `critical` is FAIL. `moderate` is WARN. Write `qa/results/a11y.json`.

7. **Auto-file bugs.** For every FAIL-severity finding across steps 3-6, invoke `bug-report` with the finding payload (title, repro steps, expected vs actual, logs, screenshot/trace references). Capture each resulting bug ID and filepath.

8. **Write release-readiness report.** Generate `qa/reports/release-readiness-<release>.md` with:
   - Header: release ID, run timestamp, commit SHA, operator.
   - Summary table with one row per stage (API, E2E, Perf, A11y) and columns for status, counts, and artifact link.
   - Blockers section: bulleted list of every FAIL bug with its BUG ID and one-line summary.
   - Warnings section: flakes, moderate a11y, near-threshold Core Web Vitals.
   - Recommendation: GO, GO-WITH-CONDITIONS, or NO-GO. NO-GO if any blocker exists. GO-WITH-CONDITIONS if only warnings and an owner has acknowledged.
   - Appendix: links to `qa/results/*.json`, fixtures, and every BUG file.

9. **Return** the report path and the recommendation string so the caller can gate the release.

## Examples

### Example 1 — green release

Inputs: `release=2026.04.2`, staging healthy, top pages `[/, /catalog, /product/demo, /cart, /checkout]`.

Flow:
- `test-data-generator` writes 1,200 fixture rows to `qa/fixtures/test-data.json`.
- `api-test-generator` runs Schemathesis: 147 checks, 0 failures.
- `e2e-test-generator` runs Playwright: 23 specs, 23 pass, no flakes.
- `performance-test` scores: LCP 1.8s / INP 140ms / CLS 0.04 on the worst page (`/checkout`). All green.
- `accessibility-audit`: 0 serious, 0 critical violations across all 5 pages.
- `bug-report` not invoked (no FAILs).
- Report `qa/reports/release-readiness-2026.04.2.md` recommends **GO** with a single-table summary and links to artifacts.

### Example 2 — performance regression

Inputs: `release=2026.04.3`, same config.

Flow:
- API: 147 / 0 fail — PASS.
- E2E: 23 / 0 fail — PASS.
- Performance: `/checkout` LCP 3.4s (regressed from 2.1s baseline); INP and CLS still green. FAIL on LCP threshold.
- Accessibility: clean — PASS.
- Orchestrator calls `bug-report` with the `/checkout` LCP regression. Bug file `qa/bugs/BUG-2026-04-19-01.md` is created with the Lighthouse report, the Chrome DevTools flamegraph path, the before/after LCP numbers, and a suggested owner (frontend team based on the heaviest long task).
- Report `qa/reports/release-readiness-2026.04.3.md` recommends **NO-GO** with one blocker: BUG-2026-04-19-01. API + E2E + A11y show PASS in the summary table.

## Constraints

- Do not publish, tag, or promote the release — this skill only reads and writes local files under `qa/`.
- Do not run against production. If `staging_url` resolves to a production host, abort.
- Do not mutate production data. The seeded fixtures live in an isolated staging database; failing to confirm isolation aborts the run.
- Respect the fixed chain order. API before E2E, perf before a11y on the same page set.
- A single stage failing does not abort the run. The caller needs the full picture to make a release decision.
- Bug reports must be deduplicated by signature (title + first stack frame or first failing assertion) so a flaky spec does not spawn 10 tickets.
- The report must fit on two screens when printed; link out for raw data rather than inlining long logs.

## Quality checks

Before returning, verify:

- `qa/reports/release-readiness-<release>.md` exists and contains all five summary rows (API, E2E, Perf, A11y, plus Blockers).
- Every artifact referenced in the report (JSON results, bug files, traces) actually exists on disk.
- The recommendation string is one of `GO`, `GO-WITH-CONDITIONS`, `NO-GO`.
- Every FAIL finding in the raw results maps to exactly one bug file. No FAIL is orphaned; no bug file is unlinked.
- Thresholds used are logged in the report (either the defaults or the overrides passed in).
- The release identifier appears in the report header and in the filename.
- No secrets (tokens, session cookies, PII from fixtures) leak into the report. Run a quick grep for `Authorization:`, `password`, and `Bearer` before writing.
