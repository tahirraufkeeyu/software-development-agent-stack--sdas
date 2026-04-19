---
name: email-campaign
description: Use when a marketer needs a full email sequence drafted (nurture, onboarding, re-engagement, or promotional) with subject line variants, mobile-first body copy, a single CTA per email, and CAN-SPAM/GDPR compliance baked in. Pulls from references/email-templates.md for proven sequence structures.
safety: writes-local
---

## When to use

Trigger this skill when the request includes any of:

- "Draft a nurture sequence for [segment]"
- "Write the onboarding emails for new signups"
- "We need a re-engagement campaign for dormant accounts"
- "Write a 3-email promotional send for the launch"
- "Turn this pillar piece into an email series"

Do not use for single transactional emails (receipts, password resets — different constraints) or one-off newsletter issues (use `social-media` for the newsletter snippet skill).

## Inputs

Required:

- **Sequence type** — nurture, onboarding, re-engagement, or promotional.
- **Audience segment** — who is receiving it, at what stage, what they already know about us.
- **Primary goal** — one of: book a demo, activate a feature, drive to content, reactivate account, buy.
- **Anchor content or offer** — the pillar piece, feature, or promotion the sequence rides on.

Optional:

- **Sender identity** — person's name or company name in the "from" line.
- **Brand voice source** — defaults to the content-writer brand voice guide.
- **Compliance region** — US only (CAN-SPAM baseline), EU (GDPR + PECR), UK (UK GDPR), or global.
- **Send cadence** — defaults per sequence type (see below).

## Outputs

A single Markdown document containing the full sequence. For each email:

1. **Position and purpose** — e.g., "Email 2 of 5: Story."
2. **Send timing** — e.g., "Day 3, 10am recipient local time."
3. **Subject line** — primary + 2 A/B variants, each ≤45 characters.
4. **Preview text** — 40-90 chars, extends the subject.
5. **Body copy** — mobile-first (single column, short paragraphs), 80-200 words.
6. **Single CTA** — button label + destination.
7. **P.S. line** (optional) — short, human, reinforces the CTA or adds warmth.
8. **Compliance footer checklist** — what must appear (physical address, unsubscribe link, etc.).

Plus a **sequence summary** at the top: total emails, total duration, success metric per email.

## Tool dependencies

- Read access to `references/email-templates.md` (required — load before drafting).
- Optional: HubSpot MCP for list segment counts and historical open/click benchmarks.
- Optional: content-writer brand voice guide for tone consistency.

## Procedure

1. **Load the templates reference.** Read `references/email-templates.md` in full.
2. **Pick the sequence skeleton by type:**
   - Nurture: 5 emails over 2-3 weeks (Welcome → Story → Value → Social Proof → Invitation).
   - Onboarding: 4 emails over 7-10 days (Activate → First Value → Tips → Feedback).
   - Re-engagement: 3 emails over 10-14 days (Miss You → What Changed → Goodbye / Last Chance).
   - Promotional: 3 emails over 5-7 days (Announce → Deepen → Deadline).
3. **Lock the success metric per email.** Nurture emails optimize for CTR to content. Onboarding optimizes for feature activation event. Re-engagement optimizes for any click. Promotional optimizes for conversion.
4. **Draft subject lines.** Each email gets 3: primary + 2 variants. Each ≤45 characters. Apply one of these levers per variant:
   - **Curiosity:** "What we got wrong about portals"
   - **Specificity:** "62% faster CI in 8 weeks"
   - **Personalization:** "Priya, your v2 migration starts here"
5. **Draft preview text.** Extends the subject. Never duplicates. Never starts with "View in browser."
6. **Draft body copy.** Mobile-first: short paragraphs (1-3 lines), single column assumption, 600px max width, 80-200 words total. One idea per email.
7. **Write the CTA.** Exactly one. Button label is a verb phrase ("Book a demo," "Read the case study," "Activate my runner"). Never "click here."
8. **Add compliance elements.** Unsubscribe link, physical mailing address, and consent reminder if GDPR/PECR applies. Flag these per email even if the ESP templates handle them.
9. **Run quality checks.** Fix before returning.

## Examples

### Example 1: Nurture sequence for platform engineering leads

Input:

```
Type: nurture
Segment: platform engineering leads who downloaded the paved road whitepaper
Goal: book a 20-minute intro call with sales
Anchor: the paved road whitepaper + Ramp case study + Runners v2 launch
Cadence: 5 emails over 18 days
Sender: Priya from Northstack
Region: global (GDPR-safe)
```

Output (email 1 abridged):

```
## Email 1 of 5: Welcome

**Send:** Day 0, within 10 minutes of whitepaper download.
**Subject (primary):** Your paved road playbook is inside
**Subject variant A:** The playbook you asked for
**Subject variant B:** Paved roads: the 42-page version
**Preview:** Plus three companies who did this before you.

---

Hi {{first_name}},

The paved road whitepaper is attached and also linked below. It's the version
we share with platform teams who are already a few months into the conversation
about replacing their portal.

If you're just scanning, skip to page 14. That is the migration sequence.

If you want to see how this looks in production, Ramp did it in eight weeks
with zero pipeline rewrites. Their case study is linked at the bottom of the
whitepaper.

One thing to flag: I wrote this. If you want to argue with anything in it,
reply to this email. I read every reply.

Read the whitepaper →

Priya Shah
Platform Advocate, Northstack

P.S. If you'd rather skip ahead and see Runners v2 in action, the demo link
lives on page 3.

---
**Compliance:**
- Unsubscribe link: required.
- Physical address: required.
- GDPR: this recipient opted in via whitepaper download form. Retain consent record.
```

Emails 2-5 follow the same structure, driving sequentially to: story (email 2), specific value (email 3), social proof (email 4), and the 20-minute call invitation (email 5).

### Example 2: Re-engagement sequence

Input:

```
Type: re-engagement
Segment: accounts with zero runner minutes in the last 60 days
Goal: any click back to the product
Anchor: Runners v2 launch + new free tier
Cadence: 3 emails over 12 days
Sender: Northstack team
Region: US only (CAN-SPAM baseline)
```

Output (email 3 abridged):

```
## Email 3 of 3: Goodbye / Last Chance

**Send:** Day 12.
**Subject (primary):** Should we stop emailing you?
**Subject variant A:** One email to decide
**Subject variant B:** We'll take the hint
**Preview:** If we don't hear back, we'll assume Northstack isn't a fit.

---

We've emailed a few times and haven't heard back. That is fine — inbox is loud.

But we'd rather stop emailing than keep guessing.

If Northstack is still interesting, even a little, click here and we'll keep
you on the list. If not, we'll take the silence as a "no thanks" and stop the
emails next week.

Keep me on the list →

No hard feelings either way.

The Northstack team

---
**Compliance:**
- Unsubscribe link: required.
- Physical address: required.
- This is the last email before suppression. Add recipient to suppression list if no click within 7 days.
```

## Constraints

- Subject lines ≤45 characters, hard limit.
- Preview text 40-90 characters, extends (not duplicates) the subject.
- Body copy 80-200 words per email. Longer breaks mobile scanning.
- **Exactly one CTA per email.** Not one primary and one secondary. One.
- Mobile-first: single column, 600px max width, paragraphs 1-3 lines.
- No banned hype words (same list as content-writer).
- No em-dashes in email body copy.
- **CAN-SPAM (US):** every email must include a physical mailing address, a working unsubscribe link that processes within 10 business days, a truthful "from" line, and a non-deceptive subject.
- **GDPR / PECR (EU / UK):** send only to recipients with a valid lawful basis (consent, contract, or legitimate interest documented). Include how to withdraw consent. Never email someone who unsubscribed from a related list.
- **Global default:** assume GDPR-level compliance unless explicitly told otherwise. It is the stricter standard and costs nothing to follow.

## Quality checks

Before returning the sequence, confirm:

- [ ] Sequence has the correct number of emails for the type (nurture 5, onboarding 4, re-engagement 3, promotional 3).
- [ ] Every email has 3 subject line options, each ≤45 chars.
- [ ] Every email has preview text that extends (not repeats) the subject.
- [ ] Every email has exactly one CTA.
- [ ] Body copy is 80-200 words per email.
- [ ] No banned hype words. No em-dashes.
- [ ] Mobile-first layout assumption documented (single column, 600px).
- [ ] Compliance footer checklist appears for every email.
- [ ] Physical address requirement flagged.
- [ ] Unsubscribe requirement flagged.
- [ ] GDPR basis identified if recipients are in EU/UK.
- [ ] Send timing per email is specific (day N, local time).
- [ ] Success metric is defined per email.
