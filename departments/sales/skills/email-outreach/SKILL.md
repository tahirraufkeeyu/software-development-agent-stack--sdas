---
name: email-outreach
description: Use when a rep needs a personalized outbound email sequence grounded in a research brief. Produces a 3-step cold or 4-step warm sequence with subject lines under 45 characters, bodies under 120 words, one clear CTA per email, and no filler phrases.
---

## When to use

Trigger this skill when:

- A `lead-research` brief has been produced and the rep is ready to initiate outbound.
- A warm introduction has been made and the rep needs a multi-step follow-up plan.
- A prospect went cold after a meeting and needs a re-engagement sequence.
- A rep is drafting a LinkedIn connection + follow-up pattern tied to a specific angle.

Do not use this for newsletter-style nurture emails or for templated mass sends. This skill produces account-specific sequences.

## Inputs

Required:

- `research_brief` — output of `lead-research`. If missing, block on this and request it.
- `sequence_type` — one of: `cold-3`, `warm-4`, `linkedin-follow`, `break-up`.
- `target_persona` — role and name of the recipient.
- `sender_identity` — who the email is from (name, title, one-line credibility).

Optional:

- `preferred_angle` — which of the three angles from the research brief to lead with. Default: angle 1.
- `referral_context` — required if `sequence_type=warm-4`. Name of the referrer and context of the introduction.
- `calendar_link` — if available, used in the CTA of the demo-request email.
- `avoid_topics` — anything off-limits (e.g. competitor names, recent layoffs).

## Outputs

A Markdown document containing the full sequence. Each email block has:

- Cadence day (Day 0, Day 3, Day 7, etc.).
- Subject line (under 45 characters).
- Body (under 120 words).
- A single, specific CTA.
- A one-line rationale for the sender to see why this email exists.

For `linkedin-follow`, the output includes the connection request message (under 300 characters, per LinkedIn's limit) plus a follow-up DM.

## Tool dependencies

- None required to draft. The skill runs on the research brief plus sender context.
- **Gmail** / **Outlook MCP** — optional; used to save drafts directly into the rep's outbox.
- **Salesforce** / **HubSpot MCP** — optional; logs the sequence as activities on the contact/account.

## Procedure

1. **Parse the research brief.** Extract: chosen angle, the trigger it's tied to, the persona, and the hypothesis.
2. **Pick the sequence pattern.**
   - `cold-3`: Day 0 opener → Day 3 value-add → Day 7 break-up.
   - `warm-4`: Day 0 intro ack → Day 4 value-add → Day 9 specific ask → Day 14 break-up.
   - `linkedin-follow`: connection request → DM 3 days after acceptance → email 7 days after DM.
   - `break-up`: single email ending a dormant sequence.
3. **Draft subject lines.** Under 45 characters, lowercase-friendly, no clickbait. Reference something specific — a trigger, a mutual connection, a metric.
4. **Draft bodies.** Under 120 words. Structure:
   - Line 1: Reference the trigger, by name. ("Saw the Insight Partners round.")
   - Lines 2-3: Hypothesis about their situation. Specific, not generic.
   - Lines 4-5: One concrete proof point — a customer name + outcome.
   - Last line: one specific CTA.
5. **Choose one CTA per email.** Valid CTAs:
   - A specific meeting time ("Tuesday 10am PT or Wednesday 2pm PT?").
   - A binary question ("Is this worth a 15-minute look, or not a priority this quarter?").
   - A resource link tied to their situation.
   - For break-up: permission to close the file.
6. **Write the LinkedIn connection message** if applicable. Under 300 chars. No pitch. Reference a specific shared context.
7. **Write the break-up email** with dignity. Name the topic, offer a resource, close the loop. No "just following up."
8. **Add a one-line rationale** above each email so the rep understands the intent and can edit with context.

## Examples

### Example 1 — cold-3 sequence for Acme Retail VP Data

Inputs: research brief showing Series B + new VP Data + real-time CDP JDs. Angle 1 selected. Persona: Priya Shah, VP Data.

Output:

> **Day 0 — Opener**
>
> *Rationale: Lead with the trigger (Series B + stated use of funds on personalization) and anchor on a relevant customer. Short and specific.*
>
> Subject: `acme + insight partners round`
>
> Hi Priya,
>
> Saw the $35M Series B and the stated focus on personalization. Congrats.
>
> We helped Warby Parker lift repeat-purchase rate 6.2% in the first 90 days after moving their Shopify + Segment + Snowflake stack to real-time. Given your job posts for real-time CDP engineers, you're likely heading to the same architecture.
>
> Worth a 15 minute comparison of that build vs. a managed path? Tuesday 10am PT or Wednesday 2pm PT?
>
> — Alex
>
> ---
>
> **Day 3 — Value-add**
>
> *Rationale: If no reply, add a proof point. Send a specific artifact — not a "circling back."*
>
> Subject: `90-day personalization blueprint`
>
> Priya — since Acme's stack mirrors Warby Parker's, I pulled the 90-day rollout plan they used.
>
> Three surfaces (homepage, PDP, cart-abandon), one measurement framework, and the internal staffing model (1 PM, 2 eng, 1 analyst).
>
> Happy to send, or walk through it live. Which is easier?
>
> — Alex
>
> ---
>
> **Day 7 — Break-up**
>
> *Rationale: Permission to close. No guilt, no "one more try." A polite break-up often gets a response.*
>
> Subject: `closing the loop`
>
> Priya — I'll stop reaching out on this thread. If real-time personalization moves up your priority list in Q3 or Q4, I'll be around.
>
> In the meantime, here's the Warby Parker teardown in case it's useful: [link].
>
> — Alex

### Example 2 — warm-4 sequence for Nimbus Logistics CIO

Referral from a mutual VC. Sequence acknowledges the intro in Day 0, sends a short case-study link in Day 4, proposes a specific meeting in Day 9, and breaks up cleanly in Day 14. Day 0 subject: `intro from sarah at bain capital`.

### Example 3 — LinkedIn connection + follow-up for a VP RevOps

- **Connection request (under 300 chars)**: "Hi Morgan — saw your talk on revenue attribution at SaaStr. We work with a few teams wrestling with the same Salesforce-to-data-warehouse mismatch you raised. Happy to connect."
- **DM after acceptance**: 2-sentence intro + one resource link + a binary CTA.
- **Email 7 days later**: references the DM, adds a customer proof point, proposes a time.

## Constraints

- Subject lines under 45 characters. Count them.
- Email bodies under 120 words. Count them.
- One CTA per email. Never two asks in the same message.
- Banned phrases: "just checking in," "circling back," "touching base," "per my last email," "hope this finds you well," "I wanted to reach out," "quick question" (unless genuinely one line).
- Every email in a cold sequence must reference something specific to the account — a trigger, a named person, a verbatim phrase from their site or a JD.
- Break-up email must not guilt-trip or imply persistence will resume.
- LinkedIn connection messages stay under 300 characters.
- No more than one link per email.
- Signature line minimal: name + one-line credibility, optional phone.

## Quality checks

Before returning:

- [ ] Subject lines all under 45 chars.
- [ ] Email bodies all under 120 words.
- [ ] Each email has exactly one CTA.
- [ ] No banned phrases present.
- [ ] Each cold email references at least one account-specific detail from the research brief.
- [ ] Break-up email is included (cold-3 and warm-4).
- [ ] For warm-4, Day 0 acknowledges the referrer by name.
- [ ] CTAs for meeting asks include either a specific time or a link — not "let me know when works."
- [ ] Rationale line present above each email.
