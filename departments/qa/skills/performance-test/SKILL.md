---
name: performance-test
description: Use when a page, release candidate, or route needs a Core Web Vitals and Lighthouse audit with prioritized fix recommendations. Runs Lighthouse via Chrome DevTools MCP, captures a performance trace, analyzes long tasks and render-blocking resources, and produces actionable guidance per metric (LCP, INP, CLS, TTFB, FCP).
---

## When to use

Invoke this skill when:
- A release candidate URL needs to be gated on Core Web Vitals thresholds.
- A reported regression ("home page feels slow") needs quantified data.
- A new feature ships a heavyweight component and you need to check its cost.
- You need a mobile vs. desktop comparison on an identical route.

Do NOT use when: the target needs auth you cannot provide to Chrome DevTools; you need multi-hour RUM-style measurement (this skill is lab-based, not field-based); you need a load test against the origin (outside scope).

## Inputs

- `url` (required): Fully qualified URL including path.
- `form_factor` (optional): `mobile` or `desktop`. Default `mobile` (matches CrUX reporting).
- `throttling` (optional): `simulated-3g`, `applied-4g`, `none`. Default `simulated-3g` for mobile, `none` for desktop.
- `runs` (optional): Number of Lighthouse runs; report median. Default `3`.
- `budget` (optional): JSON of metric thresholds; defaults to CWV "good" per `references/web-vitals-thresholds.md`.
- `auth_cookie` (optional): Session cookie set before audit for gated routes.

## Outputs

- A Markdown audit report including:
  - Metric table (LCP / INP / CLS / TTFB / FCP) with value, threshold, verdict.
  - Top 5 opportunities from Lighthouse with estimated savings.
  - Long-task list (name, duration, source) from the trace.
  - Render-blocking resources with suggested remediation.
  - A prioritized fix list (P0/P1/P2) keyed to the worst-offender metric.
- A raw trace file path (saved via DevTools MCP) for engineers to open in Chrome.

## Tool dependencies

- `mcp__chrome-devtools__new_page`, `mcp__chrome-devtools__navigate_page`, `mcp__chrome-devtools__emulate` (for form factor).
- `mcp__chrome-devtools__lighthouse_audit` (core Lighthouse run).
- `mcp__chrome-devtools__performance_start_trace`, `mcp__chrome-devtools__performance_stop_trace`, `mcp__chrome-devtools__performance_analyze_insight`.
- `mcp__chrome-devtools__list_network_requests` for render-blocking analysis.
- `Write` for the report.
- `references/web-vitals-thresholds.md` for thresholds and fix playbook.

## Procedure

1. **Open a clean page.** `mcp__chrome-devtools__new_page` with an incognito-equivalent context. Set cookie if `auth_cookie` is supplied.
2. **Emulate device.** Call `mcp__chrome-devtools__emulate` with `mobile` (375x667, 2x DPR, iOS UA) or `desktop` (1366x768).
3. **Warm a baseline navigation.** `mcp__chrome-devtools__navigate_page` to `about:blank`, then to `url`. Discard the first load.
4. **Run Lighthouse.** Invoke `mcp__chrome-devtools__lighthouse_audit` with categories `["performance"]`, desired throttling, and `onlyAudits` empty for a full run. Repeat `runs` times; record median.
5. **Capture a performance trace.** `mcp__chrome-devtools__performance_start_trace` → navigate → `performance_stop_trace`.
6. **Analyze insights.** For each insight id (`LCPBreakdown`, `INPBreakdown`, `LayoutShift`, `LongTask`, `RenderBlocking`, `DocumentLatency`), call `mcp__chrome-devtools__performance_analyze_insight`.
7. **Collect network data.** `mcp__chrome-devtools__list_network_requests` filtered by `resourceType=document,script,stylesheet` to identify render-blocking assets.
8. **Compare to budget.** Use thresholds from `references/web-vitals-thresholds.md` (good/needs-improvement/poor per metric).
9. **Rank fixes.** Map each failing metric to its playbook entry; order P0 (core-path blocker) > P1 (single-metric fix) > P2 (polish).
10. **Write report.** Markdown to `reports/perf/<yyyy-mm-dd>-<hostname>-<path>.md`.

## Examples

### Example 1 — Mobile audit of a product detail page

Input:
```json
{ "url": "https://staging.shop.example.com/products/blue-hoodie", "form_factor": "mobile", "runs": 3 }
```

Report (excerpt):

```
# Performance audit — /products/blue-hoodie (mobile, 3G)
Run date: 2026-04-19  |  Median of 3 runs

| Metric | Value  | Good  | Needs improvement | Verdict |
| ------ | ------ | ----- | ----------------- | ------- |
| LCP    | 3.8s   | <=2.5s| <=4.0s            | Needs improvement |
| INP    | 260ms  | <=200ms| <=500ms         | Needs improvement |
| CLS    | 0.04   | <=0.1 | <=0.25            | Good    |
| TTFB   | 1.1s   | <=0.8s| <=1.8s            | Needs improvement |
| FCP    | 2.3s   | <=1.8s| <=3.0s            | Needs improvement |

## Top opportunities (Lighthouse)
1. Preload LCP image (/img/hero-hoodie.webp) — est. 900ms saved.
2. Defer /vendor/analytics.js (blocking 740ms main thread).
3. Eliminate render-blocking /css/legacy.css (not used above the fold).
4. Serve /img/hero-hoodie.jpg as AVIF (est. 140KB saved).
5. Reduce JS evaluation cost of /bundle.js (3.1s main-thread time).

## Long tasks (>50ms on main thread)
- 420ms — hydrateProductGallery (bundle.js:4221)
- 180ms — analytics.init (analytics.js:12)
- 90ms  — layoutShiftObserver (bundle.js:1980)

## Render-blocking resources
- /css/legacy.css (58KB, 740ms blocking)
- /vendor/analytics.js (112KB, 740ms blocking)

## Prioritized fixes
- P0 (LCP): `<link rel="preload" as="image" fetchpriority="high" href="/img/hero-hoodie.webp">`. Move hero <img> above first script.
- P0 (TTFB): origin TTFB 1.1s — enable edge caching for product HTML.
- P1 (INP): move analytics.init behind `requestIdleCallback`, chunk hydrateProductGallery with `scheduler.yield()`.
- P1 (FCP): code-split `/bundle.js`; remove `/css/legacy.css` from critical path via `media="print" onload="..."`.
- P2: convert hero to AVIF with WebP fallback.
```

### Example 2 — Desktop audit of a dashboard behind auth

Input:
```json
{
  "url": "https://app.example.com/dashboard",
  "form_factor": "desktop",
  "throttling": "none",
  "auth_cookie": "session=abc; Domain=.example.com; Path=/"
}
```

Procedure notes:
- Set the auth cookie before navigation via `mcp__chrome-devtools__evaluate_script` with `document.cookie = ...` on a same-origin page, or inject through DevTools MCP cookie API.
- Desktop runs without throttling to reflect internal-tools reality.

Report focuses on INP (dashboards are interaction-heavy) and total blocking time from widget hydration. Typical fixes: virtualize long lists, memoize expensive selectors, offload CSV export to a worker.

## Constraints

- Always run at least 3 times and report the median; single-run Lighthouse is too noisy to gate on.
- Never gate merges on "needs improvement"; only fail CI on "poor" (per thresholds in reference).
- Do not conflate **lab** metrics (this skill) with **field** metrics (CrUX / RUM). State it in the report.
- Simulated throttling is the default because it is deterministic; note this in the report so readers do not treat it as field-accurate.
- Do not audit pages that are rate-limited or behind a CAPTCHA without an explicit `auth_cookie` and a staging host.

## Quality checks

- [ ] Median of >=3 runs reported, not single-shot.
- [ ] Every failing metric has at least one mapped fix.
- [ ] Top-5 opportunities are sourced from Lighthouse output, not invented.
- [ ] Long-task list cites script URL + line/function.
- [ ] Trace file path recorded in the report for engineer deep-dive.
- [ ] Device/throttling/run-count stated in the report header.
- [ ] Verdicts use thresholds from `references/web-vitals-thresholds.md` verbatim.
