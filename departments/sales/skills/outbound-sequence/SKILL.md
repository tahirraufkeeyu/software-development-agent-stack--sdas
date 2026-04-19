---
name: outbound-sequence
description: Use when a rep needs a complete, personalized outbound package for a named prospect account. Orchestrates research, competitive analysis, a 3-touch email sequence, and a discovery-call prep brief into a single reviewable markdown bundle.
safety: writes-local
produces: sales/sequences/<account-name>-outbound.md
consumes:
  - sales/research/<account-name>.md
  - sales/battlecards/<competitor-name>.md
chains:
  - lead-research
  - competitive-analysis
  - email-outreach
  - meeting-prep
---

## When to use

Invoke this orchestrator when:

- A rep is preparing to open a net-new account and wants a research-backed sequence ready for review before anything goes out.
- A target account was added to the quarter's top-20 list and needs a full outbound package.
- A triggering signal fired (new exec hire, funding round, tech-stack change) and the team wants a ready-to-ship sequence personalized to that trigger.
- Sales ops is batch-preparing sequences for an upcoming outbound sprint.

Do not use for warm inbound replies (use a lighter follow-up skill), for existing customers (use account-expansion), or when the rep only needs one of the sub-artifacts — call that skill directly.

## Chained skills

Four skills run in a fixed order. Research feeds everything downstream, so it must run first. Competitive analysis is conditional on an incumbent being detected.

1. `lead-research` — produces a one-page brief: firmographics, tech stack, trigger events, outreach angles, ICP fit score.
2. `competitive-analysis` — only invoked if research names an incumbent vendor; pulls or writes the battlecard.
3. `email-outreach` — drafts a 3-touch cold sequence (cold, follow-up, breakup) that cites specific triggers and angles from the brief.
4. `meeting-prep` — drafts a discovery-call brief assuming the prospect replies: attendees, likely priorities, talking points, landmines, objection handling.

## Inputs

- `account_name` — canonical company name (e.g. `Acme Retail`, `Nimbus Logistics`). Used for filenames; slugified to `acme-retail`.
- `rep_persona` — the target buyer persona (e.g. `platform engineering leader`, `VP of Data`, `CIO`). Drives tone and angle selection.
- `product_positioning` (optional) — one-liner on which of our products to lead with. Defaults to the persona's usual fit.
- `rep_name` and `rep_title` — used to sign the emails.
- `analyst_notes` (optional) — anything the rep already knows that should be respected (e.g. "already met the CTO at re:Invent"). Merged into the research brief.

## Outputs

- `sales/sequences/<account-name>-outbound.md` — primary bundled artifact (research brief + optional battlecard + 3 emails + meeting prep).
- `sales/research/<account-name>.md` — standalone research brief (shared output of `lead-research`).
- `sales/battlecards/<competitor-name>.md` — only if competitive analysis runs; may already exist and be reused.

## Tool dependencies

- Read access to enrichment sources configured for `lead-research` (e.g. Clearbit, LinkedIn, company website, recent press).
- Read access to the existing battlecard library under `sales/battlecards/`.
- Write access to `sales/research/`, `sales/battlecards/`, and `sales/sequences/`.
- The rep's approved product messaging — typically under `sales/messaging/` — for `email-outreach` grounding.

## Procedure

1. **Normalize inputs.** Slugify `account_name` to kebab-case. Verify the output paths do not already exist — if they do, append a date suffix rather than overwriting, and note it in the bundle header.

2. **Run `lead-research`.** Produce `sales/research/<account-name>.md` containing:
   - Firmographics: HQ, headcount band, revenue band, industry, ownership.
   - Tech stack: confirmed tools (from BuiltWith, job posts, GitHub orgs, engineering blog) with confidence ratings.
   - Trigger events: last 90 days of news, hires, funding, product launches. Each with a dated source link.
   - Outreach angles: three angles ranked, each tied to a trigger and to a product capability.
   - ICP fit score: 1-5 with reasoning.
   - Incumbent detection: if a competing vendor is inferable, list it with the evidence.

3. **Conditional competitive analysis.** If the brief names an incumbent:
   - Check `sales/battlecards/<competitor>.md`. If present and updated within 90 days, reuse it.
   - Otherwise invoke `competitive-analysis` to produce or refresh the battlecard: positioning, our wins, their wins, migration concerns, proof points.

4. **Run `email-outreach`.** Generate a 3-touch cold sequence grounded in the research:
   - **Touch 1 (cold).** Subject line under 50 chars, body under 90 words. Opens on a specific trigger event. One CTA (15-minute call). No pitch slab.
   - **Touch 2 (follow-up, +3 business days).** Different angle from Touch 1. Adds one proof point — customer in same segment, metric, or analyst mention. Still short.
   - **Touch 3 (breakup, +7 business days).** Permission-to-close tone. One sentence. Clean exit.
   - If a battlecard is present, Touch 2 or Touch 3 may reference a specific incumbent weakness without naming the competitor directly.

5. **Run `meeting-prep`.** Assume the prospect replies yes. Produce:
   - Likely attendees and their LinkedIn-inferred priorities.
   - Top three discovery questions tailored to the account's stack and triggers.
   - Talking points tied to the two highest-ranked angles from the research.
   - Landmines: known objections, political sensitivities, procurement quirks.
   - Suggested next step if the call goes well (technical deep-dive, POC scoping, etc.).

6. **Assemble the bundle.** Write `sales/sequences/<account-name>-outbound.md` with these sections in order: header (account, persona, rep, date), research brief (full inlined), battlecard (inlined if applicable), email sequence (Touch 1, 2, 3 with send-day offsets), meeting prep, and a final "rep review checklist" (facts to verify, any dubious claims flagged).

7. **Return** the bundle path plus a one-line summary the rep can paste into CRM activity notes.

## Examples

### Example 1 — greenfield prospect, no incumbent

Inputs: `account_name=Acme Retail`, `rep_persona=platform engineering leader`, `rep_name=Jordan Vega`.

Flow:
- `lead-research` produces `sales/research/acme-retail.md`: $50M ARR, ~180 employees, Shopify Plus on AWS (EKS + RDS Postgres), marketing on Klaviyo. Triggers: new VP Engineering (ex-Stripe, joined 38 days ago); Snowflake adoption announced on their engineering blog 11 days ago. ICP fit 4/5. No incumbent detected for our category.
- Competitive analysis skipped.
- `email-outreach` drafts three touches. Touch 1 subject: "Snowflake + Shopify Plus — what Stripe's playbook looked like". Body cites the VP Eng's prior Stripe role and the analytics-latency angle.
- `meeting-prep` briefs Jordan for a likely call with the VP Eng: priorities around data warehousing cost, concerns about schema drift from Shopify webhooks, talking points reference "cut analytics latency 68% at a comparable apparel retailer on Shopify Plus + Snowflake".
- Bundle `sales/sequences/acme-retail-outbound.md` produced. Rep review checklist flags one dubious claim ("Snowflake latency improvement figure — verify case study is still public").

### Example 2 — competitive displacement

Inputs: `account_name=Nimbus Logistics`, `rep_persona=CIO`, `rep_name=Priya Okafor`.

Flow:
- `lead-research` produces `sales/research/nimbus-logistics.md`: $220M revenue, 3PL operator, ~900 employees. Trigger: new CIO (ex-Flexport, joined 22 days ago); hiring three SREs. Tech stack names Project44 for shipment visibility (confirmed via job post mentioning Project44 integration ownership) — flagged as incumbent. ICP fit 5/5.
- Existing battlecard `sales/battlecards/project44.md` is 40 days old — reused. If missing or stale, `competitive-analysis` would regenerate it; this time it is reused.
- `email-outreach` drafts three touches. Touch 1 hooks on the new CIO's Flexport background and the SRE hiring spree. Touch 2 references the Project44 weakness around last-mile visibility at carrier-change without naming the vendor. Touch 3 is a two-line breakup.
- `meeting-prep` includes a dedicated objection-handling section for Project44 migration concerns (data historical retention, EDI integration re-cert, contract co-term options).
- Bundle `sales/sequences/nimbus-logistics-outbound.md` produced with the Project44 battlecard inlined in a collapsible section.

## Constraints

- This skill drafts only. It never sends email, never creates CRM records, never syncs with an outbound sequencer. Output is markdown on disk for rep review.
- Emails must be under 90 words (Touch 1 and 2) and under 30 words (Touch 3). Subject lines under 50 characters.
- Every claim about the prospect must trace back to a source link in the research brief. Unsourced claims are marked `[unverified]` and surfaced in the rep review checklist.
- No fabricated customer references. If `email-outreach` wants to cite a reference customer, it must come from `sales/messaging/reference-customers.md` or be left as `[REFERENCE TBD]` for the rep to fill in.
- Do not include PII beyond what is publicly visible (LinkedIn title, company bio, public statements).
- Competitive battlecards must not name-and-shame in email copy. Reference weaknesses by capability, not by vendor name, unless the rep explicitly overrides.
- Respect the chain order. Skipping research to save time violates the contract of this skill.

## Quality checks

Before returning, verify:

- The bundle file exists at `sales/sequences/<account-name>-outbound.md` and contains all required sections (header, research, optional battlecard, three emails, meeting prep, rep review checklist).
- The three emails are present, labeled Touch 1 / 2 / 3, with word-count and character-count meta lines under each subject line.
- Every outreach angle in the emails maps to a specific trigger or stack item in the research brief — no floating claims.
- If an incumbent was named, a battlecard is either referenced or inlined. If no incumbent, the battlecard section is omitted cleanly (no empty heading).
- ICP fit score and at least three trigger events are present in the research brief.
- The rep review checklist lists every `[unverified]` claim and every `[REFERENCE TBD]` placeholder.
- The rep's name and title appear exactly as passed in, with no typos. Signature block is consistent across all three emails.
- No send action occurred. The final line of the bundle reads "Status: draft — not sent."
