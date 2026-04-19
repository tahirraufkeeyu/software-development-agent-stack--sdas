---
name: rfp-responder
description: Use when a rep receives a formal RFP, RFI, or security questionnaire. Parses the document into a requirement tree, maps each item to our capabilities, flags must-have gaps early, and drafts compliant section-by-section responses using the customer's language and cited evidence.
---

## When to use

Trigger this skill when:

- A buyer submits a formal RFP, RFI, or RFQ document (Word, PDF, or spreadsheet).
- A procurement team sends a security questionnaire (SIG, CAIQ, or custom).
- A due-diligence buyer (private equity, M&A target) sends a request for information.
- An existing customer's procurement triggers a vendor review with a questionnaire.

Do not use this for informal buyer emails asking general questions — use a targeted email reply instead. The RFP responder is for structured, multi-section documents.

## Inputs

Required:

- `rfp_document` — the RFP text, file path, or pasted contents. Must be complete.
- `our_capability_library` — pointer to our answer bank, case studies, security docs. Typically in Notion or a dedicated RFP tool.
- `customer_context` — who is issuing the RFP, their stated objective, their evaluation timeline.

Optional:

- `prior_responses` — previous responses to similar RFPs, as raw material.
- `deal_owner_guidance` — rep's notes on what to emphasize, what to avoid.
- `win_themes` — strategic themes to thread through every section (e.g. "time to value," "vendor consolidation").
- `submission_format` — the format the buyer expects back (Word with their template, Excel with their rows, PDF).

## Outputs

Three artifacts:

1. **Requirement tree** — structured extraction of every numbered/lettered requirement in the RFP, flagged as Must / Should / Nice / Informational.
2. **Gap analysis** — requirements we do not fully meet, categorized as Partial / Missing / Custom-buildable, with a recommended response strategy for each.
3. **Draft response** — section-by-section draft in the buyer's template, using the buyer's section numbering and language, with evidence cited per answer.

## Tool dependencies

- **Notion MCP** or a dedicated RFP tool (Loopio, Responsive) — highly recommended. The answer bank is the skill's primary source.
- **WebFetch** — optional; pulls the buyer's public site for context.
- **Salesforce** / **HubSpot MCP** — optional; reads prior opportunities with the same buyer.
- **Docx / PDF reader** — required if the RFP is supplied as a file. If unavailable, the user must paste the content.

## Procedure

1. **Ingest the RFP.** Extract every requirement. Preserve the buyer's numbering (2.3.1, §4(a)(ii), etc.) exactly. Do not renumber.
2. **Classify each requirement.**
   - `Must` — explicit must-have, pass/fail criteria.
   - `Should` — strongly preferred.
   - `Nice` — bonus.
   - `Informational` — disclosure only, no scoring.
   Classification is often stated directly ("mandatory requirement"); if implicit, flag for the rep to confirm.
3. **Map each requirement to our capability.** For each requirement, one of:
   - `Full` — we meet it natively.
   - `Partial` — we meet it with caveats.
   - `Roadmap` — planned within 6 months.
   - `Custom` — we can meet it via services/configuration.
   - `Gap` — we do not meet it.
4. **Produce the gap analysis early.** Before drafting any prose, surface `Must + Gap` combinations as deal-threatening items. The rep needs 24-48 hours to make the go/no-go call on these.
5. **Draft responses section by section.**
   - Use the buyer's section headings, exactly.
   - Use the buyer's language — if they say "data lineage," don't respond about "provenance."
   - Lead each answer with a direct yes/no/partial where applicable.
   - Follow with one paragraph of explanation and one citation of evidence.
6. **Cite evidence inline.** Every substantive claim must reference one of:
   - A named case study.
   - A security document (SOC 2 report, ISO 27001 cert, Pen Test summary).
   - A feature documentation page or API reference.
   - An architecture diagram.
   Citations are explicit: "Evidence: See Case Study — Acme Retail (Appendix B, page 12)."
7. **Thread win themes.** If provided, weave them through the executive summary and into at least three answer bodies. Do not force them where they do not fit.
8. **Write the executive summary last.** It references the themes that emerged from the answers, not the other way around.
9. **Handle security / compliance sections with precision.** Answer exactly what is asked. Do not volunteer more. Over-disclosure creates procurement friction.
10. **Produce the output in the buyer's submission format.** If they supplied a Word template with specific fields, output those fields filled. Do not rewrite the document structure.

## Examples

### Example 1 — RFP response for Nimbus Logistics visibility platform

Inputs: 47-page RFP from Nimbus Logistics covering functional, non-functional, security, and commercial requirements. 142 numbered requirements total. Customer context: new CIO consolidating visibility spend, evaluation deadline 4 weeks.

Output structure:

> **Gap Analysis (delivered first, Day 1)**
>
> - Must-haves we fully meet: 118 of 142.
> - Must-haves we partially meet: 19. Recommended strategy per item listed below.
> - Must-haves we do not meet: 5. These are deal-threatening.
>   - §3.4.2: "Real-time vehicle telemetry ingestion at 100Hz per asset." — Our current platform supports 10Hz. Recommended response: disclose gap, propose roadmap commitment, price the custom work separately.
>   - §5.1.7: "On-premises deployment option with no cloud dependency." — We are cloud-native. Recommended response: propose dedicated VPC deployment as alternative. Flag for CRO go/no-go.
>   - [...]
>
> **Draft Response** (excerpt)
>
> §3.1.1 — Requirement: "The platform shall provide real-time visibility into in-transit shipments across ocean, rail, and road modalities."
>
> Response: Yes. Our platform ingests carrier and tracking data across all three modalities, with a median event latency of 45 seconds and a 99th percentile of 3 minutes. Evidence: Architecture overview, Appendix C, page 4. Reference customer: Maersk — 2024 case study (Appendix D).

### Example 2 — Security questionnaire for a mid-market SaaS buyer

Inputs: 180-item CAIQ-style questionnaire from Helios Analytics. Output is a spreadsheet-shaped response with Y/N/Partial columns, explanation column, and evidence column. Skill flags that 4 items require net-new attestation from our CISO's team before submission. Draft responses for the remaining 176 are produced.

## Constraints

- Preserve the buyer's numbering exactly. Renumbering is a procurement red flag.
- Use the buyer's language. If they say "supplier," do not reply "vendor."
- Every substantive claim has an evidence citation. No unsupported assertions.
- Must-have gaps are surfaced in the gap analysis on Day 1, before prose drafting.
- Do not over-disclose on security questions. Answer what is asked.
- If the answer is "no," say so. Buyers detect evasion and score it worse than an honest gap.
- No marketing superlatives in RFP prose. "Industry-leading" and "best-in-class" are banned.
- The executive summary is under 500 words.
- Every answer lists the version of evidence cited (e.g. SOC 2 Type II report, dated YYYY-MM-DD).

## Quality checks

Before returning:

- [ ] Every numbered requirement from the RFP appears in the requirement tree.
- [ ] Every requirement is classified Must/Should/Nice/Informational.
- [ ] Every requirement is mapped Full/Partial/Roadmap/Custom/Gap.
- [ ] Gap analysis lists all `Must + Gap` combinations as deal-threatening.
- [ ] Draft uses the buyer's headings and numbering.
- [ ] Draft uses the buyer's vocabulary — verified against a quick diff of terms they used vs. terms we used.
- [ ] Every answer starts with a direct yes/no/partial.
- [ ] Every answer cites specific evidence.
- [ ] Security section answers only what is asked.
- [ ] Output is in the buyer's requested format.
- [ ] Win themes appear in the executive summary and at least three answer bodies (if provided).
