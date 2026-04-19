---
name: seo-optimizer
description: Use when a page or post needs keyword research, intent classification, and on-page SEO review before publish. Produces a keyword map (seed to related queries with intent), on-page recommendations (title, meta, headings, links, alt text, schema), and a Core Web Vitals checklist.
safety: writes-local
---

## When to use

Trigger this skill when the request includes any of:

- "SEO review this draft before it goes live"
- "Do keyword research for [topic]"
- "Optimize this landing page"
- "What should the meta tags be for the new case study?"
- A finished draft plus a request to "make sure this ranks"

Do not use for paid search copy (different playbook), technical SEO audits of a whole domain (that is a separate engagement), or link-building outreach.

## Inputs

Required:

- **Page URL or draft content** — the thing being optimized.
- **Primary goal** — one of: rank for a specific query, capture organic traffic for a topic cluster, or improve CTR on an existing page.

Optional:

- **Seed keyword** — if known. If not, the skill will derive one from the content.
- **Target audience intent** — helps disambiguate between a "how to" and "best X tools" angle.
- **Competitor URLs** already ranking for the query.

## Outputs

A single SEO brief containing:

1. **Keyword map** — seed keyword, 8-15 related queries grouped by intent (informational, navigational, commercial, transactional).
2. **On-page recommendations:**
   - Title tag (≤60 chars).
   - Meta description (≤155 chars).
   - H1 (exactly one, matches intent).
   - H2/H3 outline with keywords in natural placement.
   - Internal links (minimum 3, to relevant cluster pages).
   - External links (minimum 1 to a high-authority source).
   - Image alt text suggestions for every image.
3. **Schema.org markup** — the JSON-LD block to embed (`Article`, `FAQPage`, `HowTo`, `Product`, or `BreadcrumbList` as appropriate).
4. **Core Web Vitals checklist** — what to verify before publish.
5. **Gap note** — 2-3 bullets on what the current draft is missing vs the top-ranking competitors.

## Tool dependencies

- WebSearch / web-fetch (required) — for SERP checks, competitor pulls, and Google auto-suggest.
- Optional: Google Search Console MCP (if available) for existing-page CTR data.

## Procedure

### 1. Keyword research

1. **Start with the seed.** If not provided, extract it from the page's thesis. The seed should be 2-4 words.
2. **Pull related queries.** Use WebSearch for:
   - Google auto-suggest (`seed + a-z`) for long-tail variants.
   - "People also ask" box for the seed.
   - Top 10 SERP results — scan their H1s and H2s for recurring phrases.
3. **Classify intent for each query:**
   - **Informational:** "what is X," "how does X work," "X explained" — user wants to learn.
   - **Navigational:** "X brand name," "X login," "X docs" — user wants a specific site.
   - **Commercial:** "best X," "X vs Y," "X alternatives," "X reviews" — user is comparing.
   - **Transactional:** "buy X," "X pricing," "X free trial," "X demo" — user is ready to act.
4. **Filter to relevance.** Drop queries that do not match the page's goal. A case study should not try to rank for transactional queries.

### 2. On-page optimization

1. **Title tag:** ≤60 characters, primary keyword near the front, brand name at the end only if it fits. Sentence case preferred.
2. **Meta description:** ≤155 characters, primary keyword once, ends with a clear value statement. Not a sentence truncated from the body.
3. **H1:** exactly one per page, matches search intent, close match to the title tag without being identical.
4. **H2/H3 hierarchy:**
   - H2s cover major sub-topics; each H2 should target a related query from the keyword map.
   - H3s break down H2s. Do not skip from H2 to H4.
   - Keywords in headings must read naturally. No stuffing.
5. **Internal links:** 3+ to relevant cluster pages. Anchor text is descriptive ("CI migration playbook"), never "click here."
6. **External links:** 1+ to a high-authority source (industry report, primary research, spec doc). Never link to a direct competitor.
7. **Image alt text:** every image gets descriptive alt text, 6-12 words, includes the keyword only if naturally relevant. Decorative images get `alt=""`.

### 3. Schema markup

Pick one primary schema type based on the page:

- **Blog post / educational content:** `Article` with `headline`, `author`, `datePublished`, `image`.
- **Case study:** `Article` + optional `Review` if there is a customer quote with rating.
- **Product / landing page:** `Product` with `name`, `description`, `offers`.
- **FAQ section on any page:** add `FAQPage` as secondary schema.
- **Tutorial / walkthrough:** `HowTo` with `step` array.
- **All pages:** `BreadcrumbList` for breadcrumb navigation.

Return the JSON-LD block as a code fence the dev team can paste into `<head>`.

### 4. Core Web Vitals checklist

Flag for the dev team:

- [ ] **LCP (Largest Contentful Paint) <2.5s** — hero image optimized (WebP/AVIF), not lazy-loaded, preloaded if above the fold.
- [ ] **INP (Interaction to Next Paint) <200ms** — defer non-critical JS, avoid long tasks on interaction.
- [ ] **CLS (Cumulative Layout Shift) <0.1** — width/height attributes on every image, reserved space for embeds and ads.
- [ ] Page tested on PageSpeed Insights for both mobile and desktop.
- [ ] Core Web Vitals field data reviewed in Search Console if the page has history.

### 5. Gap analysis

Read the top 3 ranking pages for the primary keyword. Note:

- Topics they cover that the current draft does not.
- Content formats they use (comparison tables, FAQs, embedded video, calculators).
- Freshness signals (publish date visible, "updated 2026").

Return 2-3 gap bullets.

## Examples

### Example 1: Blog post SEO brief

Input: Draft post titled "The paved road is beating the portal" targeting platform engineers.

Output (abridged):

```
## Keyword map

Seed: internal developer portal alternatives

Informational:
- what is a paved road in platform engineering
- internal developer portal vs paved road
- how does a paved road work

Commercial:
- internal developer portal alternatives
- best paved road tools 2026
- backstage alternatives

Transactional:
- paved road template pricing
- northstack pricing

## On-page

Title: Internal developer portal alternatives: why platform teams pick paved roads (59 chars)

Meta: Internal developer portals promised self-service. Paved roads deliver it.
Here is what platform teams learned running both for two years. (148 chars)

H1: Internal developer portal alternatives: why platform teams pick paved roads

H2 outline:
- What a paved road actually is
- Where the portal model broke (targets "backstage alternatives")
- Three signs your portal is becoming a museum
- How teams migrate from portal to paved road
- Paved road vs internal developer portal: the honest comparison

Internal links:
- /docs/paved-road-reference-architecture (anchor: "paved-road reference architecture")
- /blog/backstage-migration-guide (anchor: "Backstage migration")
- /customers/ramp (anchor: "how Ramp rolled out paved roads")

External link:
- CNCF Platform Engineering Maturity Model (anchor: "CNCF platform engineering model")

Image alt text:
- Hero diagram: "Paved road architecture showing template, runner, and policy layers"
- Screenshot: "northstack init command generating a working pipeline on first run"

## Schema

{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Internal developer portal alternatives: why platform teams pick paved roads",
  "author": {"@type": "Organization", "name": "Northstack"},
  "datePublished": "2026-04-19",
  "image": "https://northstack.dev/blog/paved-road-hero.png"
}

## Core Web Vitals checklist
- [ ] Hero image under 200KB in WebP
- [ ] Hero not lazy-loaded (above the fold)
- [ ] All images have width/height attributes
- [ ] Tested on PageSpeed Insights

## Gap note
- Top 3 competitors all include a comparison table. This draft does not. Add one.
- Two of the top three have a FAQ block. Add 4-6 FAQs and tag with FAQPage schema.
- All top-ranking pages show a visible "updated 2026" date. Make sure ours does too.
```

### Example 2: Landing page SEO review

Input: Pricing page for Northstack Runners.

Output (abridged):

```
## Keyword map
Seed: ci runner pricing
Transactional: northstack pricing, ci runner pricing, per-minute ci cost
Commercial: github actions vs northstack, circleci alternatives pricing

## On-page
Title: Runners pricing: $0.004/min, no seat fees (54 chars)
Meta: Transparent per-minute CI pricing. No seat fees. See a cost estimate for
your pipeline volume in 30 seconds. (114 chars)
H1: Runners pricing
...

## Schema
Use Product schema with offers. Add FAQPage for the pricing FAQ at the bottom.

## Gap note
- No pricing comparison vs GitHub Actions or CircleCI. Competitors have this.
- No ROI calculator. Add one — this is a high-intent page.
- Missing trust signals near pricing (SOC 2, uptime).
```

## Constraints

- Title tag ≤60 characters, hard limit.
- Meta description ≤155 characters, hard limit.
- Exactly one H1 per page.
- Keyword density target: primary keyword appears naturally 3-8 times in a 1,500 word piece. Never force it.
- Internal link anchors are descriptive, never "click here" or "read more."
- No keyword stuffing in alt text, headings, or body copy.
- Schema JSON-LD must validate against Google's Rich Results Test before ship.
- Do not optimize for keywords the content cannot honestly deliver on — that is the fastest way to get hit by a helpful content update.

## Quality checks

Before returning the brief, confirm:

- [ ] Seed keyword appears in title, meta, H1, and first 100 words of the body.
- [ ] Every related query has an assigned intent.
- [ ] Title ≤60 chars, meta ≤155 chars.
- [ ] Exactly one H1 suggested.
- [ ] H2/H3 hierarchy has no skipped levels.
- [ ] At least 3 internal links with descriptive anchors.
- [ ] At least 1 external link to a non-competitor authority source.
- [ ] Every image in the draft has a proposed alt text.
- [ ] Schema block is valid JSON-LD.
- [ ] Core Web Vitals checklist included.
- [ ] Gap note identifies at least 2 missing elements vs top SERP competitors.
