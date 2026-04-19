---
name: proposal-writer
description: Use when a rep needs to generate a tailored customer proposal after discovery. Produces a full proposal document mapping their stated requirements to our solution, with scope, deliverables, phased timeline, pricing, assumptions, case studies, team bios, and next steps.
safety: writes-local
---

## When to use

Trigger this skill when:

- Discovery is complete and the buyer has asked for a proposal or SOW.
- A champion has requested a written document to circulate internally for budget approval.
- A deal is advancing from demo to commercial discussion and the rep needs to formalize scope.
- An RFP response has been returned and the buyer wants a more readable commercial proposal alongside it.

Do not use this for first-touch collateral or for highly prescriptive RFP responses — use `rfp-responder` for the latter.

## Inputs

Required:

- `customer_name` — legal entity.
- `discovery_notes` — structured or unstructured notes from discovery calls. Must include stated pain, desired outcome, and any requirements.
- `our_proposed_solution` — which product/package is being proposed, at what scale.
- `pricing_structure` — tiers or SKUs to include, with any negotiated terms.

Optional:

- `timeline_constraint` — customer deadline (e.g. "must be live by end of Q2").
- `competitive_context` — if the customer is also evaluating a competitor.
- `case_study_library` — list of internal case studies available to cite (preferred over letting the skill invent).
- `prior_proposal_template` — if the org has a canonical proposal to pattern-match.

## Outputs

A single Markdown document built from these sections (see `references/proposal-template.md` for the full template):

1. Cover page — customer name, our company, proposal title, date, version, contacts.
2. Executive Summary — 3-4 paragraphs, stands alone.
3. Our Understanding of Your Situation — mirrors their words from discovery.
4. Proposed Approach — mapped section-by-section to their requirements.
5. Scope — in-scope, out-of-scope, clearly delimited.
6. Deliverables — itemized list, each with acceptance criteria.
7. Timeline — phased with milestones and dependencies.
8. Investment — pricing tiers and line items.
9. Assumptions — contractual prerequisites.
10. Our Team — bios of the proposed delivery team.
11. Case Studies — 2-3 relevant, named.
12. Next Steps — concrete actions with owners and dates.
13. Terms & Conditions — reference to MSA / SOW.
14. Appendix — supporting materials.

## Tool dependencies

- **Notion MCP** — strongly recommended. Pulls the case study library, team bios, and the canonical proposal template.
- **Salesforce** / **HubSpot MCP** — optional; pulls opportunity field data and prior proposal versions.
- **WebSearch** / **WebFetch** — optional; used only to confirm customer-facing facts referenced in the proposal.

## Procedure

1. **Parse discovery notes** into a structured requirement set. For each stated pain, identify: (a) the underlying business outcome, (b) the verbatim language the customer used, (c) any quantified metric. These three things go into the "Understanding" section.
2. **Map requirements to solution.** Build a one-to-one map from each stated requirement to the feature, module, or service that addresses it. If a requirement is partially addressed, say so; do not overclaim.
3. **Draft the Executive Summary.** Three paragraphs:
   - Paragraph 1: Their situation in their language, with the metric that matters most to them.
   - Paragraph 2: What we propose, named concretely (product, scope, timeline).
   - Paragraph 3: The quantified outcome we're anchoring to, tied to a named case study.
4. **Write Our Understanding** — bullets that mirror their language, sourced from discovery. If discovery notes use the word "visibility," use "visibility," not "observability."
5. **Write Proposed Approach** — organize by their requirements, not our product modules. Each sub-section addresses one requirement and names the part of our solution that addresses it.
6. **Define scope crisply.** In-scope is a numbered list of what we will deliver. Out-of-scope is an equally clear list of what we won't. Ambiguity in scope is the single biggest risk to a proposal.
7. **Itemize deliverables** with acceptance criteria. "Integration with Snowflake" is not a deliverable; "Snowflake integration validated against three target tables with sample queries returning in <2s" is.
8. **Build a phased timeline.** Phase 0 (kickoff), Phase 1 (foundation), Phase 2 (rollout), Phase 3 (optimization). Each phase has start/end, milestones, and customer dependencies.
9. **Present pricing.** Show list, any discount, and effective price. Break down by SKU, seat, services, and any one-time fees. If multi-year, show Year 1 / Year 2 / Year 3.
10. **State assumptions.** Every proposal has assumptions — SSO already configured, customer provides project manager, data is in a named schema, etc. Surfaced assumptions prevent renegotiation.
11. **Propose the team.** Names, roles, tenure, one sentence on relevant experience. Do not invent people; use the customer-success and implementation team members actually assigned.
12. **Cite 2-3 named case studies** from the provided library. Each must be from the same vertical or a comparable scale. Cite specific metrics.
13. **Write Next Steps** — list of actions with owners and dates. Signature, kickoff call, access provisioning. No vague "we'll be in touch."

## Examples

### Example 1 — Acme Retail omnichannel personalization proposal

Input: Acme Retail ($50M ARR, Shopify Plus on AWS, new VP Data), discovery notes show they want real-time personalization across web and email within 90 days, measured by a 5% lift in repeat purchase rate.

Output excerpt:

> **Executive Summary**
>
> Acme Retail operates a high-growth omnichannel apparel business with $50M in 2025 revenue and a 3x YoY increase in repeat-purchase rate as a stated 2026 priority. Your team has identified fragmented customer data across Shopify, Klaviyo, and NetSuite as the central constraint on real-time personalization.
>
> We propose implementing the Nimbus CDP across your Shopify + Klaviyo + Snowflake stack over a 10-week engagement, with real-time personalization live in 8 weeks and measurement infrastructure in 10.
>
> Warby Parker saw a 6.2% lift in repeat purchase rate in the 90 days following a comparable implementation. We are targeting a 5% lift for Acme Retail over the same window, with a shared dashboard tracking weekly.

Scope includes: identity resolution, real-time event pipeline, 3 named personalization surfaces (homepage, PDP, cart abandonment email). Out-of-scope: paid-media audience sync (phase 2). Timeline: 10 weeks with 4 milestones. Investment: $180K year-one platform + $45K implementation, with Year 2 at $195K.

### Example 2 — Nimbus Logistics visibility platform proposal

For Nimbus Logistics (previously Project44 customer, new CIO). Proposal anchors on the new CIO's stated 90-day priority to "consolidate visibility spend," maps requirements directly to their RFI response, and cites Maersk and DHL Supply Chain case studies. Pricing includes a migration credit acknowledging their Project44 contract overlap.

## Constraints

- Every cited customer metric must exist in the provided case study library. Do not invent outcomes.
- Use the customer's language in "Our Understanding." If discovery says "shipping delays," do not switch to "fulfillment latency."
- No filler phrases: remove "we are pleased to submit," "it is our belief that," "at this time."
- Every deliverable has an acceptance criterion.
- Timeline phases each have a milestone AND a customer dependency. Dependencies prevent schedule slippage.
- Keep executive summary under 400 words.
- No section exceeds 2 pages printed.
- If a requirement cannot be met, say so plainly in the Proposed Approach section. Hidden gaps surface in procurement and kill deals.

## Quality checks

Before returning:

- [ ] Cover page includes date, version number, and a named customer contact.
- [ ] Executive summary references a specific customer metric (revenue, user count, deadline).
- [ ] Every requirement from discovery appears in Our Understanding.
- [ ] Every requirement is addressed in Proposed Approach or explicitly marked out-of-scope.
- [ ] In-scope and out-of-scope lists are both non-empty.
- [ ] Each deliverable has an acceptance criterion.
- [ ] Timeline has start/end dates, at least 3 milestones, and customer dependencies per phase.
- [ ] Pricing shows list, discount, effective price, and multi-year if applicable.
- [ ] Assumptions section has at least 3 items.
- [ ] Case studies are named (no "a Fortune 500 retailer") and include a quantified outcome.
- [ ] Next Steps has owners and dates — not "TBD."
