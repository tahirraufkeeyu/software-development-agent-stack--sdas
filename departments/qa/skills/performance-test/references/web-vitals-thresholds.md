# Core Web Vitals Thresholds and Fix Playbook

Official thresholds per Google's Core Web Vitals program (current as of 2026). Thresholds are assessed at the **75th percentile** of page loads, segmented by **mobile** and **desktop**. A URL is "passing" only when all three Core Web Vitals (LCP, INP, CLS) are in the "Good" bucket at p75.

## Thresholds table

| Metric | Good     | Needs improvement | Poor   | Measurement |
| ------ | -------- | ----------------- | ------ | ----------- |
| LCP    | <= 2.5 s | <= 4.0 s          | > 4.0 s | p75, per device class |
| INP    | <= 200 ms| <= 500 ms         | > 500 ms| p75, per device class |
| CLS    | <= 0.1   | <= 0.25           | > 0.25 | p75, per device class |
| TTFB   | <= 0.8 s | <= 1.8 s          | > 1.8 s | p75 (diagnostic, not a CWV) |
| FCP    | <= 1.8 s | <= 3.0 s          | > 3.0 s | p75 (diagnostic, not a CWV) |

Notes:
- LCP, INP, CLS are the three Core Web Vitals; TTFB and FCP are diagnostic supporting metrics.
- Thresholds are identical across mobile and desktop; the difference is entirely in the underlying p75 distribution — mobile budgets are harder to hit because of slower CPUs and networks.
- INP replaced FID as a Core Web Vital in March 2024.

## Mobile vs. desktop — what actually differs

Same thresholds, different realities:

- **Network:** field p75 mobile is typically "Slow 4G" (~1.6 Mbps down, 150 ms RTT). Desktop p75 is closer to home cable (20+ Mbps, 30 ms RTT).
- **CPU:** mobile p75 CPU is ~4x slower than a mid-tier laptop. Lighthouse "mobile" profile applies a 4x CPU slowdown to match.
- **Viewport:** CLS is computed over the visible viewport; mobile viewports are shorter, so a single banner shift has a larger impact fraction.
- **Scripts:** third-party chat/analytics tags cost proportionally more on mobile main threads, so INP regressions show up on mobile first.

## Measurement methodology

- **Field (CrUX / RUM):** what Google uses to assess your site. Aggregated over 28 rolling days. p75 per device class.
- **Lab (Lighthouse, WebPageTest, this skill):** deterministic, single-load. Useful for regression detection and fix validation, not for attesting to field performance.
- **Rule:** report both when possible. Never tell a PM "CWV is good" based on a lab run alone.

## Common failure modes and fixes

### LCP (Largest Contentful Paint)

Typical failure: LCP element is a hero image that loads lazily or after a JS framework hydration.

Fixes, in order of leverage:
1. Identify the LCP element from a trace; confirm it is in the initial HTML.
2. `<link rel="preload" as="image" fetchpriority="high" href="/hero.avif">` in `<head>`.
3. Set `fetchpriority="high"` on the hero `<img>`.
4. Serve AVIF/WebP with responsive `srcset` + `sizes`.
5. Inline critical CSS for above-the-fold layout; defer the rest.
6. Avoid `display: none` + JS reveal on the LCP candidate.
7. If LCP is text: preload the font (`<link rel="preload" as="font" type="font/woff2" crossorigin>`); use `font-display: swap`.
8. Reduce TTFB — LCP can never beat TTFB + critical-path fetch time.

### INP (Interaction to Next Paint)

Typical failure: click handler kicks off a 400 ms synchronous render or hits a long-task-prone third-party script.

Fixes:
1. Audit top long tasks via `performance_analyze_insight` (`LongTask` insight).
2. Break work with `await scheduler.yield()` or `requestIdleCallback` between chunks.
3. Defer third-party scripts (`<script src=".." defer>` or `async`) or load on interaction.
4. Virtualize long lists (react-virtual / react-window).
5. Memoize expensive selectors / component trees.
6. Offload JSON parsing, CSV generation, crypto to a Web Worker.
7. Avoid layout thrash — batch DOM reads and writes.
8. Replace inline `onClick` heavy work with event delegation and debounced updates.

### CLS (Cumulative Layout Shift)

Typical failure: images without dimensions, ads/embeds injected late, web fonts causing reflow, above-the-fold banners appearing after JS runs.

Fixes:
1. Set `width` and `height` on every `<img>` and `<video>`; CSS `aspect-ratio` for responsive.
2. Reserve space for ads/embeds with min-height placeholders.
3. Font preload + `size-adjust`/`ascent-override` to match fallback metrics.
4. Never animate layout-affecting properties; use `transform` / `opacity`.
5. Inject banners/cookie consent above the fold server-side, not via client JS.
6. For SPA route transitions, keep layout anchors stable across page swaps.

### TTFB (Time to First Byte)

Typical failure: uncached dynamic rendering, cold serverless function, DB roundtrip in the request path, excessive redirects.

Fixes:
1. Cache HTML at the edge (stale-while-revalidate) where safe.
2. Remove any 3xx redirect chain on the canonical URL.
3. Warm serverless targets, or move to a runtime with no cold start.
4. Move auth checks to an edge middleware rather than origin.
5. Use HTTP/2 or HTTP/3; preconnect to critical origins.
6. Compress (Brotli) and precompute HTML where possible.

### FCP (First Contentful Paint)

Typical failure: render-blocking CSS/JS in `<head>`; large DOM before first paint; flash-of-unstyled-content mitigation gone wrong.

Fixes:
1. Inline critical CSS; load the rest asynchronously (`media="print" onload="this.media='all'"`).
2. Remove or defer render-blocking `<script>` tags; prefer `defer`.
3. Split the main bundle so the initial chunk is under 100 KB gzipped.
4. Avoid rendering a loading spinner as the first paint — paint meaningful shell.
5. Server-side render the shell even on SPA frameworks.

## Budget recommendation for CI

Block the build on **poor** per this table:

```json
{
  "LCP_ms": 4000,
  "INP_ms": 500,
  "CLS": 0.25,
  "TTFB_ms": 1800,
  "FCP_ms": 3000
}
```

Warn (do not block) on **needs improvement**:

```json
{
  "LCP_ms": 2500,
  "INP_ms": 200,
  "CLS": 0.1,
  "TTFB_ms": 800,
  "FCP_ms": 1800
}
```

Always use the median of at least 3 Lighthouse runs for each gate.
