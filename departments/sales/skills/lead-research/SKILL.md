---
name: lead-research
description: Use when a rep needs a pre-outreach account brief on a named company. Produces a one-page dossier covering firmographics, tech stack, trigger events, hiring signals, known pain points, and three concrete outreach angles tied to triggers.
safety: safe
---

## When to use

Trigger this skill when:

- A named account lands in an SDR queue and needs a first-touch brief before outreach.
- A rep is prepping for a net-new cold sequence and has only a company name and a target persona.
- An AE inherits a dormant opportunity and needs a refresh on what has changed at the account in the last 90 days.
- Marketing hands over an MQL and wants the account researched before an SDR reaches out.

Do not use this for pre-meeting preparation when a meeting is already booked — use `meeting-prep` instead, which adds attendee-level research and an agenda.

## Inputs

Required:

- `company_name` — legal or common name of the target company (e.g. "Acme Retail", "Nimbus Logistics").

Optional but recommended:

- `company_domain` — resolves ambiguity and speeds up lookup.
- `target_persona` — role being pursued (e.g. "VP of Data", "Head of RevOps").
- `icp_definition` — text description of what a fit customer looks like, for scoring.
- `prior_crm_notes` — dump from Salesforce or HubSpot if the account has history.

## Outputs

A single Markdown document, roughly 400-600 words, structured as:

1. **Snapshot** — company name, domain, HQ, headcount band, revenue band, ownership (private/public/PE-backed), key verticals served.
2. **Tech stack** — observed frontend (from BuiltWith/Wappalyzer-style inference or job-post mentions), cloud, data warehouse, CRM, MarTech.
3. **Recent triggers (last 90 days)** — funding, leadership changes, layoffs, M&A, product launches, regulatory exposure. Dated bullets with source URLs.
4. **Hiring signals** — open roles relevant to the persona (team expanding, new function being built, tooling implied by JDs).
5. **Pain signals** — Glassdoor themes, G2/Capterra reviews of incumbent tools if known, public outage or security reports.
6. **ICP fit score** (1-5) and **urgency score** (1-5), with one-line justification each.
7. **Three outreach angles** — each tied explicitly to a trigger and the target persona, with a one-sentence hypothesis.
8. **Risks and unknowns** — what the brief could not verify.

## Tool dependencies

- **WebSearch** / **WebFetch** — required. Skill cannot complete without live lookups.
- **Salesforce** or **HubSpot MCP** — optional; used if `prior_crm_notes` not supplied.
- **Notion MCP** — optional; used to pull the internal ICP definition if not supplied.

If WebSearch is unavailable, the skill should stop and ask the user to paste in company URL, careers page, and press release links rather than hallucinate.

## Procedure

1. **Resolve identity.** Confirm the exact company from name plus domain. Disambiguate if multiple companies share a name (e.g. "Apex Systems" the staffing firm vs. "Apex" the analytics startup).
2. **Pull firmographics** from the company site's About/Careers/Contact pages, LinkedIn company page, and Crunchbase-style sources. Record headcount band, funding stage, revenue band.
3. **Infer the tech stack**:
   - Job postings are the highest-signal source — a JD listing "Snowflake, dbt, Segment, Salesforce" tells you the stack.
   - Engineering blog posts and conference talks.
   - BuiltWith/Wappalyzer signals if available.
4. **Scan for triggers** over the last 90 days: news, press releases, SEC filings if public, executive LinkedIn changes, layoff trackers.
5. **Read hiring signals.** Count open roles in the target function. Extract tooling mentions from JDs.
6. **Collect pain signals.** Look at the company's Glassdoor reviews for themes (e.g. "legacy systems", "manual reporting"), and search G2/Capterra if the incumbent vendor is known.
7. **Score ICP fit** against the supplied ICP definition on a 1-5 scale. Then score urgency based on the density and recency of triggers.
8. **Draft three angles.** Each must name the trigger, the persona, and a testable hypothesis. Generic angles ("improve efficiency") are not acceptable.
9. **Note risks and unknowns** honestly. If you couldn't find revenue, say so.

See `references/research-framework.md` for the structured 4-quadrant framework and scoring rubric.

## Examples

### Example 1 — Acme Retail (cold)

Input: `company_name: Acme Retail`, `target_persona: VP Data`, ICP = "mid-market retailer $50M-$500M revenue on modern cloud data stack".

Output excerpt:

> **Snapshot** — Acme Retail, HQ Austin TX, ~450 employees, ~$50M ARR, private, omnichannel apparel.
>
> **Tech stack** — Shopify Plus storefront, AWS us-east-1, Snowflake (from a Jan 2026 data engineer JD), dbt, Segment, Klaviyo, NetSuite ERP.
>
> **Triggers** —
> - 2026-02-14: Series B, $35M led by Insight Partners. Stated use of funds: "expand data and personalization."
> - 2026-03-02: Hired first-ever VP of Data (ex-Warby Parker).
> - 2026-03-20: Posted 4 data engineering roles, all mentioning "real-time CDP."
>
> **ICP fit: 5/5. Urgency: 5/5.**
>
> **Angles** —
> 1. New VP of Data inheriting a Snowflake + Segment stack — offer a "first 90 days" data architecture review tied to their stated personalization initiative.
> 2. Series B earmarked for personalization — lead with a Warby Parker-adjacent case study.
> 3. Four open data engineering roles suggest they plan to build in-house — position our managed CDP as a way to ship in 60 days while they hire.

### Example 2 — Nimbus Logistics (dormant revival)

Input: `company_name: Nimbus Logistics`, `prior_crm_notes: "Closed-lost Q2 2024, competitor = Project44, champion left."`

Output highlights the two material changes since closed-lost: a new CIO (ex-Flexport) and a Project44 contract renewal window inferred from a JD asking for "visibility platform migration experience." Angles include a direct "your champion is gone but your CIO knows our customer Maersk" play.

## Constraints

- Every trigger claim must have a dated source URL. No undated bullets.
- Three angles, not five. If you cannot find three trigger-grounded angles, return two and mark ICP urgency as low rather than padding.
- No generic pain statements. "They probably struggle with data silos" is not acceptable. Tie every claim to evidence.
- Stay under 700 words total. The brief is read in 90 seconds or not at all.
- Do not fabricate revenue, headcount, or executive names. Say "not disclosed" when unknown.

## Quality checks

Before returning, verify:

- [ ] Snapshot has headcount band and revenue band (or explicit "not disclosed").
- [ ] At least one tech-stack item is sourced from a job posting or blog, not assumed.
- [ ] Every trigger has a date within the last 120 days and a URL.
- [ ] ICP fit and urgency scores each have a one-line justification.
- [ ] Each of the three angles names (a) a specific trigger, (b) the persona, (c) a testable hypothesis.
- [ ] Risks section acknowledges at least one unknown.
