---
name: marketing-weekly
description: Use when running the marketing team's weekly content cycle end-to-end on a Mon-Fri cadence. Orchestrates competitor monitoring, long-form content, SEO, social, email, and analytics into a single weekly report.
safety: writes-local
produces: marketing/weekly/<week-of>-report.md
consumes:
  - marketing/weekly/<week-of>/competitor-digest.md
  - marketing/weekly/<week-of>/post.md
  - marketing/weekly/<week-of>/seo-meta.json
  - marketing/weekly/<week-of>/social-pack.md
  - marketing/weekly/<week-of>/newsletter.md
  - marketing/weekly/<week-of>/metrics.json
chains:
  - competitor-monitor
  - content-writer
  - seo-optimizer
  - social-media
  - email-campaign
  - analytics-report
---

## When to use

Trigger this orchestrator when:

- It is Monday (or the start of a marketing workweek) and the team needs the full weekly cycle executed.
- Someone says "run the marketing week", "kick off the weekly content cycle", or "spin up this week's marketing package".
- A new `<week-of>` folder under `marketing/weekly/` needs to be populated end-to-end.
- Mid-week catch-up is requested and prior steps must be re-run deterministically against the same `<week-of>` slug.

Do not use for one-off content (call `content-writer` directly), single-campaign work (use `email-campaign` or `social-media` alone), or monthly/quarterly retros (use a reporting skill).

## Chained skills

In execution order:

1. `competitor-monitor` — Monday digest of competitor moves (pricing changes, launches, hiring signals, SEO wins). Writes `competitor-digest.md`.
2. `content-writer` — drafts the long-form piece of the week against the editorial calendar and signals from the digest. Writes `post.md`.
3. `seo-optimizer` — optimizes the draft for the target keyword cluster, produces meta/title/structure recommendations. Writes `seo-meta.json` and updates `post.md` in place.
4. `social-media` — derives a LinkedIn post (150-300 words) plus an X thread from the optimized piece. Writes `social-pack.md`.
5. `email-campaign` — drafts a newsletter segment referencing the piece, with subject line variants and UTM-tagged link. Writes `newsletter.md`.
6. `analytics-report` — on Friday, pulls sessions, conversion rate, social engagement, and email open/click for the week. Writes `metrics.json` and rolls up the final `<week-of>-report.md`.

## Inputs

Required:

- **Week-of slug** — ISO Monday date, e.g. `2026-04-13`. Used as both folder name and report prefix.
- **Editorial calendar entry** — topic, angle, target audience, target length, CTA destination.
- **Tracked competitor list** — handles, domains, and optional RSS feeds for `competitor-monitor`.
- **Primary keyword cluster** — passed to `seo-optimizer`.

Optional:

- **Launch flag** — set to `true` when the week coincides with a product launch; skews tone across all downstream skills.
- **Newsletter segment name** (default: `weekly-digest`).
- **Analytics date range override** — default is Mon 00:00 UTC through Fri 17:00 UTC of the given `<week-of>`.

## Outputs

A single Markdown roll-up at `marketing/weekly/<week-of>-report.md`, containing:

1. **Header** — `Week of <week-of>`, brand, owner, launch flag state.
2. **Artifact index** — relative links to the six consumed files.
3. **Top-line metrics** — sessions, WoW delta, pricing-page CVR, LinkedIn impressions, X impressions, newsletter open rate, newsletter CTR.
4. **What shipped** — bullet list of the long-form piece, social pack variants, newsletter drop time.
5. **Competitor context** — 3-5 bullets lifted from the Monday digest.
6. **Next week** — editorial calendar preview and any follow-up TODOs surfaced by downstream skills.

Side effects: creates the `marketing/weekly/<week-of>/` directory and its six artifact files.

## Tool dependencies

- Filesystem write access under `marketing/weekly/`.
- Each chained skill's own dependencies (brand voice guide, keyword tools, analytics MCP, email platform MCP, social MCP). The orchestrator does not call external APIs itself — it dispatches to sub-skills.
- Read access to the editorial calendar source (Notion, Airtable, or `marketing/editorial-calendar.md`).

## Procedure

1. **Resolve `<week-of>`.** If the user did not supply one, compute the ISO Monday of the current week. Create `marketing/weekly/<week-of>/` if absent. Fail loudly if the directory already contains files from a prior run unless `--force` was passed.
2. **Monday — competitor-monitor.** Invoke `competitor-monitor` with the tracked list. Write `competitor-digest.md`. Surface the three most relevant signals for the week's topic.
3. **Mon-Tue — content-writer.** Pass the editorial calendar entry plus the top signals from step 2 as context. Invoke `content-writer`. Write `post.md`. If the calendar entry is missing required fields, stop and ask.
4. **Tuesday — seo-optimizer.** Invoke `seo-optimizer` against `post.md` and the primary keyword cluster. Write `seo-meta.json` (title, meta description, H1, internal link targets, schema suggestions). Apply non-destructive edits to `post.md`.
5. **Wednesday — social-media.** Derive one LinkedIn post (150-300 words, single-image or carousel suggestion) and one 5-9 tweet X thread from the optimized `post.md`. Write `social-pack.md`. Schedule in the social tool if the MCP is configured; otherwise leave as drafts.
6. **Thursday — email-campaign.** Draft a newsletter segment referencing `post.md` with two subject-line variants, preheader, 120-180 word body, and UTM-tagged CTA. Write `newsletter.md`.
7. **Friday — analytics-report.** Pull metrics for the week using the range from Inputs. Write `metrics.json`. Generate `<week-of>-report.md` per Outputs. Link every artifact with a relative path.
8. **Close out.** Print the report path. If the launch flag was set, also print the launch-attributed signup count in the final summary.

## Examples

### Example 1 — standard week (Northstack, dev-tools brand)

Week-of `2026-04-13`. Editorial calendar entry: "CI cache strategies for polyglot monorepos", audience = platform engineering leads, target = 1,400 words, CTA = docs page.

- Monday — `competitor-monitor` surfaces BuildJet's free-tier announcement, Depot's blog on remote caching, and a CircleCI pricing footnote change. Digest highlights the BuildJet move as the top signal.
- Mon-Tue — `content-writer` drafts 1,420 words. Opens with the cache-miss cost math, positions remote cache as one option among three, cites the BuildJet announcement neutrally in an "alternatives" callout.
- Tuesday — `seo-optimizer` targets the "ci cache" cluster (primary: "ci cache", secondary: "monorepo build cache", "remote build cache"). Meta description 148 chars. Adds two internal links to `/docs/runners` and `/blog/monorepo-101`.
- Wednesday — `social-pack.md` has one LinkedIn carousel brief (6 slides) and a 7-tweet X thread. LinkedIn body example excerpt (emojis allowed here): "Cache misses are a tax on every PR. Three strategies we've seen work, ranked by pain-to-payoff ratio."
- Thursday — newsletter segment: subject A "Stop paying the cache-miss tax", subject B "Three CI cache strategies, ranked". 142-word body, single CTA to the post.
- Friday — `metrics.json`: 4,200 sessions (+14% WoW), 1.8% pricing-page CVR, LinkedIn 3,400 impressions (72 reactions, 11 comments), X thread 9,100 impressions, newsletter 38% open, 6.2% CTR. Report links to all six artifacts.

### Example 2 — launch week

Week-of `2026-04-20`. Launch flag `true`. Product: "Northstack Runners v2", shipping Thursday.

- Monday — `competitor-monitor` digest is scanned but deprioritized; top three signals appended as an appendix.
- Mon-Tue — `content-writer` skews to a launch narrative: problem framing, what's new, benchmarks, migration path. 1,650 words.
- Tuesday — `seo-optimizer` adds a Product schema block to `seo-meta.json` and wires the meta description around the launch tagline.
- Wednesday — `social-pack.md` leads with a launch carousel (8 slides) and a pinned launch thread; reply-thread copy preloaded for common objections.
- Thursday — newsletter segment becomes the lead story, not a segment. Subject A "Runners v2 is live". Body references pricing, migration doc, and a 30-day grandfathering note.
- Friday — `metrics.json` includes a `launchAttributed` block: 612 signups tagged `utm_campaign=runners-v2`, 41 inbound demo requests, 22% lift on the pricing page. Report calls these out in a dedicated "Launch" section above top-line metrics.

## Constraints

- Never skip a chained skill silently. If one is unavailable or fails, write a stub artifact with a clear `STATUS: skipped — <reason>` header and continue; the final report must list every skipped step.
- Do not overwrite a prior week's folder. `<week-of>` is immutable once created.
- The report is Markdown only — no HTML, no screenshots embedded as base64.
- Emojis are permitted only inside example social-media post bodies, never in the report or any H2 headings.
- All timestamps in the report are UTC with explicit `Z` suffix.
- Do not publish anything automatically. The orchestrator drafts; a human schedules.

## Quality checks

Before returning success:

- [ ] `marketing/weekly/<week-of>/` exists and contains all six expected artifacts (or explicit skip stubs).
- [ ] `<week-of>-report.md` links resolve as relative paths from the `marketing/weekly/` root.
- [ ] Top-line metrics block has every field populated or marked `n/a` with a reason.
- [ ] Competitor context section has between three and five bullets.
- [ ] If launch flag is true, the report has a Launch section and `metrics.json` has a `launchAttributed` block.
- [ ] No emojis appear outside of `social-pack.md` post bodies.
- [ ] No unresolved TODOs or `<placeholder>` tokens remain in the report.
- [ ] The Next week section names the topic and owner of the following week's editorial entry.
