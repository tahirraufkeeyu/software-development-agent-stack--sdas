---
name: competitive-analysis
description: Use when a rep needs a battlecard against a named competitor for a live deal or quarterly enablement. Maps competitor positioning, ICP, pricing, differentiators, weaknesses, win/loss patterns, and public review sentiment into a one-page battlecard.
safety: safe
---

## When to use

Trigger this skill when:

- A rep enters a deal where a specific competitor is incumbent or finalist (e.g. "they're also evaluating Gong").
- A CRO or PMM is refreshing the quarterly battlecard library.
- A new competitor enters the category and the field team needs positioning quickly.
- A deal is stalling and the rep suspects the competitor is winning on a specific angle.

Do not use this for market-level category analysis. This skill is adversarial and per-competitor. For a category landscape, use a market research tool.

## Inputs

Required:

- `competitor_name` — e.g. "Gong", "Outreach", "Clari".
- `our_product_context` — a sentence describing our product and category so the output contrasts meaningfully.

Optional:

- `deal_context` — the specific deal this battlecard is for (vertical, size, persona). Tightens the output.
- `known_objections` — objections the rep has already heard in this deal.
- `internal_win_loss_notes` — paste from CRM or Gong.

## Outputs

A single Markdown battlecard with these sections:

1. **Header** — competitor name, category, one-sentence positioning in their words.
2. **Target ICP** — who they sell to best.
3. **Pricing** — public list prices if available, leaked/anecdotal if not, with source attribution.
4. **Strengths** — 3-5 bullets where they genuinely outperform us.
5. **Weaknesses** — 3-5 bullets, each backed by a review citation or public incident.
6. **Differentiators (ours vs. theirs)** — side-by-side, no puffery.
7. **Objection handling** — 3-5 common objections raised in deals against them, with recommended response patterns.
8. **Landmines** — questions we can ask in discovery that expose their weakness.
9. **Win/loss patterns** — when we tend to win, when we tend to lose.
10. **Proof points** — case studies, G2 stats, security certs to cite.

See `references/battlecard-template.md` for the full template.

## Tool dependencies

- **WebSearch** / **WebFetch** — required. Need to pull competitor website, pricing pages, G2 and Capterra reviews, and recent news.
- **Salesforce** or **HubSpot MCP** — optional; pulls win/loss notes on deals tagged with this competitor.
- **Notion MCP** — optional; read the existing battlecard archive if one exists.

## Procedure

1. **Establish their positioning in their words.** Pull the H1 from the competitor's homepage and their "About" / "Why us" copy. Do not paraphrase — the battlecard should tell us what they tell the market.
2. **Identify their ICP.** Logos on their site, case studies, industries pages. Note both who they feature and who they don't. If every case study is >1000 employees, they don't sell to SMB even if their site says they do.
3. **Find pricing.**
   - Public pricing page: record list prices and tier structure.
   - If gated: search for "[competitor] pricing" on Reddit, community forums, Glassdoor sales-rep reviews. Note source quality.
   - Note contract terms: annual only? 3-year required? Auto-renew clauses?
4. **Scrape G2 and Capterra reviews.** Pull the 10 most recent reviews and the 10 lowest-starred reviews. Extract common themes. Quantify: "4 of last 10 reviews mention slow support."
5. **Scan recent news.** Layoffs, leadership departures, outages, lawsuits, acquisitions, funding — all affect the narrative.
6. **Identify 3-5 genuine strengths.** Be honest. A battlecard that pretends the competitor has no strengths is worthless in a real deal.
7. **Identify 3-5 weaknesses with evidence.** Each weakness needs a citation: review quote, incident report, missing feature page.
8. **Write objection handling.** For each top objection ("they're cheaper", "they integrate with X", "they have more logos"), write a short response that acknowledges, reframes, and redirects. No dismissive responses.
9. **Build landmines.** These are discovery questions the prospect can ask the competitor that will expose a weakness without us having to attack directly. Example: "What's your median time to first value?" lands differently depending on the competitor.
10. **Document win/loss patterns.** When did we win? When did we lose? If no internal data is available, mark as "anecdotal."

## Examples

### Example 1 — Battlecard vs. Gong (for a conversation intelligence company)

Output excerpt:

> **Positioning (their words)**: "The Revenue Intelligence Platform."
>
> **Target ICP**: Mid-market and enterprise B2B SaaS, 100+ reps. Most case studies feature companies >$100M ARR.
>
> **Pricing**: No public list. Community reports $1,600/user/year floor for mid-market, three-year term standard. Source: Reddit r/sales thread, 2025-11-12.
>
> **Strengths**:
> - Brand recognition; often the default "safe" choice for a VP Sales.
> - Robust call-recording infrastructure and transcript search.
> - Large library of integrations, especially Salesforce.
>
> **Weaknesses**:
> - Implementation quoted at 8-12 weeks in 6 of 10 reviewed G2 reviews in Q1 2026.
> - Weak coaching workflow; users report exporting to spreadsheets (G2, 2026-02-08).
> - Three-year term is a common deal-breaker for PE-owned accounts with annual budget cycles.
>
> **Landmines**:
> 1. "What is your minimum contract term?"
> 2. "Can we get a ramp-down clause if reps leave?"
> 3. "What is the median implementation time for our segment?"

### Example 2 — Battlecard vs. Notion (for a sales knowledge-base startup)

Output flags Notion's breadth as both strength and weakness: strength ("already in their stack"), weakness ("not purpose-built for sales content; permissions model breaks at scale"). Objection handling addresses "we already have Notion" with a reframe around revenue-weighted content freshness rather than features.

## Constraints

- Every weakness must cite a source: a review, an incident, a missing page. No "we heard they're bad at X."
- Pricing must be tagged `public`, `leaked`, or `anecdotal`. Never present anecdotal pricing as fact.
- Strengths section is non-optional. If you cannot find three, you have not researched enough.
- Objection responses must not contain "actually" or "that's not true." Reframe, do not contradict.
- Under 800 words total.
- Do not invent product features. If you do not know whether they have SSO, say so.

## Quality checks

Before returning:

- [ ] Positioning is a direct quote from the competitor's own site.
- [ ] Pricing tagged with source and source quality.
- [ ] At least 3 strengths and 3 weaknesses, each with evidence.
- [ ] Objection handling covers the rep's supplied `known_objections` if provided.
- [ ] Landmines are real discovery questions, not thinly disguised attacks.
- [ ] Win/loss pattern section names conditions, not verdicts ("we win when the prospect values X", not "we're better").
- [ ] No hyperbole: remove "best", "industry-leading", "unmatched" from our column.
