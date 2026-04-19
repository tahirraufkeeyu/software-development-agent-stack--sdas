---
name: competitor-monitor
description: Use when the marketing team needs a weekly competitive intelligence digest covering competitor content, positioning shifts, pricing changes, and product launches. Produces a dated digest with new content summaries, positioning deltas, pricing deltas, product moves, and a recommended response for each signal.
---

## When to use

Trigger this skill when the request includes any of:

- "Run the weekly competitor digest"
- "What did [competitor] ship this week?"
- "Did pricing change on any of our competitors?"
- "Summarize what's new across our competitive set"
- A scheduled Monday-morning job

Do not use for deep one-off competitor teardowns (that is a separate analyst engagement), win/loss analysis (sales-led), or feature-by-feature comparison tables (use `content-writer` with the competitor data as input).

## Inputs

Required:

- **Competitor list** — 3-8 named competitors with URLs for: blog, newsroom/changelog, pricing page, and primary LinkedIn account.
- **Our category** — so the skill can judge what matters vs what is noise.

Optional:

- **Previous digest** — the last weekly output. Enables week-over-week diff framing.
- **Focus areas** — e.g., "we especially care about pricing changes and enterprise positioning."
- **Cadence override** — defaults to weekly (Monday 9am); biweekly or monthly can be requested.

## Outputs

A single dated digest with these sections:

1. **Header** — week range (e.g., "Week of 2026-04-13 to 2026-04-19"), competitors tracked, and a one-line executive summary.
2. **New content** — per competitor, 1-3 bullet summaries of new blog posts, case studies, whitepapers, or videos shipped this week. Each with URL and publish date.
3. **Positioning shifts** — any change in homepage hero, tagline, category claim, or messaging hierarchy vs the previous snapshot.
4. **Pricing changes** — added/removed tiers, price deltas, new add-ons, changes to free tier or trial length.
5. **Product moves** — launches, major feature additions, integrations, deprecations, public beta announcements.
6. **Social / executive signal** — notable posts from competitor CEOs, heads of product, or official company accounts (LinkedIn and X).
7. **Our recommended response** — for each signal that matters, a specific action: update comparison page, draft rebuttal post, brief sales, ignore, or escalate.

## Tool dependencies

- WebSearch / web-fetch (required) — for pulling blog posts, pricing pages, and newsroom updates.
- Optional: RSS reader or Changetower for automated change detection on pricing and landing pages.
- Optional: LinkedIn and X via whatever access is available (public pages only).
- Optional: Notion MCP to file the digest in the marketing intel workspace.
- Optional: Slack MCP to post the digest into `#marketing` on completion.

## Procedure

### 1. Set the baseline

1. **Load last week's digest** if provided. If not, note that this is a baseline run and subsequent runs will be diff-oriented.
2. **Confirm the competitor list and URLs.** Flag any URL that has 404'd since last run — itself a signal.

### 2. Gather signals per competitor

For each competitor, check in this order (roughly 5-10 minutes per competitor if automated):

1. **Blog / newsroom RSS.** Pull everything published in the last 7 days.
2. **Pricing page.** Fetch current HTML; diff against last week's snapshot. Note any changed numbers, added tiers, or removed features.
3. **Homepage hero.** Fetch current copy above the fold. Note any change in H1, tagline, or primary CTA.
4. **Product changelog or release notes.** If public, pull entries from the last 7 days.
5. **LinkedIn company page.** Top 3 posts from the last 7 days, ranked by engagement.
6. **Executive LinkedIn (CEO, CPO, CMO).** Top posts from the last 7 days if public.
7. **X/Twitter** for the company handle and 1-2 key executives, if active.

### 3. Classify each signal

For every finding, tag it:

- **Severity:** high (material strategic move), medium (notable tactical move), low (routine activity).
- **Category:** content / positioning / pricing / product / social.
- **Relevance to us:** direct overlap / adjacent / unrelated.

Drop "low severity + unrelated" signals. They are noise.

### 4. Write the digest

- Keep each bullet to 1-2 sentences. This is a scannable document.
- Lead every section with the most important signal, not the chronologically first one.
- If a section has nothing material, write "No material activity." Do not pad.

### 5. Write the recommended response

For each high or medium signal, produce one of five responses:

- **Update comparison page** — when a competitor ships a feature we already match or beat.
- **Draft rebuttal content** — when positioning or messaging directly attacks our category claim.
- **Brief sales** — when pricing changes or a new tier affects active deals.
- **Ignore** — default for low-relevance moves. Explicit ignores save future cycles.
- **Escalate** — pricing undercut, direct feature parity with our moat, or an acquisition/funding event.

### 6. Close the loop

- File the digest (Notion, Google Doc, or wherever the team stores intel).
- Post a 3-bullet summary into `#marketing` on Slack with a link to the full doc.
- Save this week's page snapshots for next week's diff.

## Examples

### Example 1: Weekly digest

Output (abridged):

```
# Competitive digest — week of 2026-04-13 to 2026-04-19

Competitors tracked: CircleCI, GitHub Actions, Buildkite, Earthly, Depot.

**Executive summary:** Depot shipped a per-minute pricing change that undercuts
us by 15% on the smallest tier. Buildkite is quietly pivoting messaging from
"flexible CI" to "CI for platform teams" — direct overlap with our positioning.
Everything else is routine.

## New content

**Depot**
- "Why per-minute pricing is the only honest CI pricing" (blog, 2026-04-15). A
  direct shot at capacity-based pricing. URL: depot.dev/blog/per-minute
- Case study with Vercel's internal platform team (2026-04-17).

**Buildkite**
- "Buildkite for platform teams" (landing page, 2026-04-14). New segment page.
- "The paved road pattern in CI" (blog, 2026-04-18). Uses "paved road" language
  for the first time on their blog.

**GitHub Actions**
- No material content. Minor docs updates only.

**CircleCI**
- "2026 State of Software Delivery Report" (whitepaper, 2026-04-16). Annual
  report, mostly defensive.

**Earthly**
- No material activity.

## Positioning shifts

**Buildkite** — homepage H1 changed from "The hybrid CI/CD platform" to "CI
built for platform teams." Tagline and hero CTA also updated. This is a
category-level shift targeting the same buyer we target.

**Depot** — no homepage change, but new pricing-page subhead: "The only
per-minute CI that shows you the meter." Direct pricing-transparency play.

## Pricing changes

**Depot** — smallest tier dropped from $0.008/min to $0.005/min (-37%). Free
tier unchanged at 400 min/month. Enterprise pricing still "contact sales."

No changes on CircleCI, GitHub Actions, Buildkite, or Earthly.

## Product moves

**Depot** — shipped "Depot Policies" public beta (2026-04-17). Appears to be
a direct response to our Runners v2 sidecar. Feature parity on 3 of 5 capabilities
listed on our launch page; misses per-network-route policy and Kubernetes-native
enforcement.

**GitHub Actions** — `actions/cache@v4` GA. Minor.

**Buildkite** — no product moves.

## Social / executive signal

**Depot's CEO** — LinkedIn post on 2026-04-17 announcing Policies beta has
280+ reactions and 40+ comments. Several comments from our active prospects.

**Buildkite's Head of Product** — LinkedIn post framing "platform engineers
need tools, not platforms." Direct jab at the IDP/paved-road category.

## Our recommended response

| Signal | Response |
|---|---|
| Depot price cut -37% on smallest tier | **Escalate** to leadership + brief sales. Our smallest tier is now 20% more expensive. Decide this week whether to match, differentiate on value, or leave it. |
| Depot Policies beta | **Update comparison page** this week. Lead with the two capabilities they lack. Draft a short blog post (not a rebuttal, a technical deep-dive on why our approach handles the two cases they miss). |
| Buildkite repositioning to "CI for platform teams" | **Draft rebuttal content.** A 300-word LinkedIn post from our CEO clarifying the difference between "CI with platform features" and "a paved-road runtime." Not a takedown, a definition. |
| Buildkite's "paved road pattern" blog | **Ignore,** but note it. Our category language is becoming table stakes. |
| Depot Vercel case study | **Brief sales.** Vercel is a logo in our active pipeline. Sales needs this before the next call. |
| CircleCI annual report | **Ignore.** |
```

### Example 2: Baseline (first-ever) run

Output (abridged):

```
# Competitive digest — baseline snapshot, 2026-04-19

This is a baseline run. Future digests will be framed as week-over-week diffs
against this snapshot.

Competitors tracked: CircleCI, GitHub Actions, Buildkite, Earthly, Depot.

**Executive summary:** Baseline only. Snapshots of pricing, homepage hero, and
latest 5 blog posts captured per competitor. See full doc.

## Current pricing snapshots

[Per-competitor table of tiers, prices, and free-tier terms as of 2026-04-19]

## Current homepage heroes

[Per-competitor H1 + tagline + primary CTA as of 2026-04-19]

## Latest blog posts

[Last 5 posts per competitor with URLs and dates]

## Our recommended response

No deltas yet. Next week's digest will surface changes against this baseline.
Suggested follow-up this week: subscribe to each competitor's RSS feed, set up
Changetower on each pricing page and homepage.
```

## Constraints

- **Factual accuracy over speed.** Every claim in the digest is linked to a URL or explicitly flagged as "unverified."
- **No speculation dressed as fact.** If we think a competitor is planning a move, that is flagged as "hypothesis," not stated as news.
- **No direct quoting of competitor customers** unless the quote is already public.
- **No accessing paywalled or gated content** beyond what is publicly available. If a case study is gated, note it as gated and skip.
- **Respect robots.txt and terms of service** on all fetches.
- **Digest length: 1-3 pages.** Longer than that and nobody reads it. Cut ruthlessly.
- **Every "recommended response" has an owner implied** (sales, content, exec) and a timeframe (this week, this sprint, next quarter).
- **Ignore is a valid response.** Use it often. Not every competitor move deserves a reaction.

## Quality checks

Before returning the digest, confirm:

- [ ] Every signal has a source URL or is explicitly flagged unverified.
- [ ] Executive summary is ≤3 sentences and front-loads the single most important finding.
- [ ] Each section has real content or says "No material activity" — no padding.
- [ ] Pricing changes are quantified (absolute and percentage).
- [ ] Positioning shifts include the old and new language side by side.
- [ ] Every high/medium signal has a specific recommended response.
- [ ] At least one "ignore" appears — if everything is urgent, nothing is.
- [ ] Digest fits in 1-3 pages when rendered.
- [ ] Competitor list matches the input (nothing dropped, nothing added silently).
- [ ] Baseline snapshots saved for next week's diff.
