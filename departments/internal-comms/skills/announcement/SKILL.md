---
name: announcement
description: Use when drafting an internal or external announcement — product launches, milestones, or policy changes. Produces a tone-appropriate (formal or casual) draft with hook, substance, reason, and call-to-action, suitable for Slack, email, or an internal blog post.
safety: writes-local
---

## When to use

Trigger this skill when:

- A product launch, feature GA, or deprecation needs an announcement.
- A milestone has been reached (customer count, revenue, hiring, anniversary) and leadership wants to share it.
- A policy change (holiday closure, new tool rollout, process update) needs to be communicated to employees.
- A customer-facing change (pricing, TOS, service window) requires a heads-up.

Do **not** use this skill for:

- Incident updates — use `incident-report` or `engineering:incident-response`.
- Routine status updates — use `status-update`.
- Marketing campaigns with external budget and funnel implications — those require the marketing team.

## Inputs

Required:

- **Announcement type** — one of: `launch`, `milestone`, `policy-change`.
- **Topic / subject** — what is being announced.
- **Audience** — `employees`, `customers`, `partners`, or `public`.
- **Tone** — `formal` or `casual`. (Default: `casual` for employees, `formal` for customers/partners/public unless overridden.)

Optional:

- **Effective date** (for policy changes and launches).
- **Channel** — Slack, email, blog, changelog entry — affects length and formatting.
- **Signer** — the person or team the announcement is from.
- **Supporting links** — documentation, FAQ, demo video, blog post.
- **Prior related announcements** — for continuity.

## Outputs

A single Markdown draft. Structure depends on announcement type:

**Launch:**
1. Hook (one sentence that names the thing and the outcome).
2. What changed (concrete, specific).
3. Why it matters (user or business benefit).
4. Call to action (try it, read more, opt in).

**Milestone:**
1. Specific number or achievement.
2. Short story (what got us here).
3. Thanks (to people, teams, or customers who made it possible).
4. Call to action (optional — celebrate, share, keep going).

**Policy change:**
1. What is changing.
2. When (effective date).
3. Why (the reason, honestly stated).
4. Impact (what each audience needs to do).
5. FAQ (3–5 anticipated questions).

## Tool dependencies

- **Slack MCP** — to post drafts to a channel (with user confirmation).
- **Notion MCP** — to save drafts alongside prior announcements for continuity.
- **Gmail MCP** — to save as a draft for email distribution.
- **Read** — to reference the company style guide if one exists in the repo.

## Procedure

1. **Confirm inputs.** Announcement type, topic, audience, tone, effective date (if policy change or dated launch). If a required input is missing, ask before drafting.
2. **Pick the structure** for the announcement type.
3. **Write the hook.** For launches, lead with the outcome for the user, not the feature name. For milestones, lead with the specific number. For policy changes, lead with the change itself, not the context.
4. **Fill in substance.** Be concrete. Numbers, dates, names. For launches, name one thing the user can now do that they could not do before.
5. **State the reason.** Every announcement earns the reader's attention; explain why the reader should care or what you were trying to solve. Honesty beats spin.
6. **Include a call to action.** Even milestones have one (share, celebrate, keep going). Policy changes need the explicit "what you need to do by when."
7. **For policy changes, draft the FAQ.** 3–5 questions the reader will actually ask. Anticipated real concerns, not softball questions.
8. **Match tone.**
   - Formal: full sentences, no contractions, no exclamation points. Third-person or "the company." Suitable for legal, comp, external partners.
   - Casual: first-person ("we"), contractions OK, one exclamation point maximum, conversational. Suitable for internal Slack, employee newsletters, product updates.
9. **Match channel length.**
   - Slack: 5–10 sentences, threaded for detail.
   - Email: 100–300 words.
   - Blog: 300–800 words.
   - Changelog entry: 1–2 sentences (defer to the `changelog` skill instead).
10. **Check for banned patterns.** No hype words unless the data supports them ("game-changing," "revolutionary"). No vague benefit claims ("streamlined experience"). No passive voice for actions that have a clear owner.
11. **Return** the draft. Recommend a review pass by the named signer or by comms/legal (policy changes) before publication.

## Examples

### Example 1: Product launch, casual tone, employees and customers

Input: "Draft a launch announcement for SSO support. Audience is customers; tone is casual. Effective immediately. Signer is the product team. Support doc is at /docs/sso."

Output:

```
# SSO is here

You can now sign in to your workspace with Okta or Azure AD. If you have been waiting for this — thanks for your patience, and your setup should take under 10 minutes.

**What's new.** Admins can enable SSO under Settings → Security → Single Sign-On. We support SAML 2.0 with Okta and Azure AD today; Google Workspace is next, scheduled for May.

**Why it matters.** If your security team has been asking you to deprecate shared passwords and enforce SSO everywhere, that conversation just got easier. Users get one less password to remember; admins get centralized provisioning and deprovisioning.

**Get started.** Head to Settings → Security, or read the setup guide at /docs/sso. If you hit a snag, reply to this email or ping us in the #product-support channel of our community Slack.

— The Product team
```

### Example 2: Policy change, formal tone, employees

Input: "Draft a policy change announcement. We are closing the office for a winter shutdown from 2026-12-22 through 2027-01-02. Audience is employees; tone is formal. Signer is the People team."

Output:

```
# Winter Shutdown: 2026-12-22 through 2027-01-02

The company will observe a full winter shutdown from Tuesday, 2026-12-22 through Friday, 2027-01-02. All offices will be closed and employees are not expected to work during this period.

**When.** Tuesday, 2026-12-22 through Friday, 2027-01-02 (inclusive). Normal operations resume Monday, 2027-01-05.

**Why.** A company-wide pause ensures that everyone takes time off at the same time, which reduces the coordination cost of covering colleagues and the guilt of logging off while others are working. We have observed in prior years that a synchronized shutdown produces a measurable return-to-work energy boost in January.

**What you need to do.**
- By 2026-12-05, confirm handoff coverage for any customer-facing responsibilities with your manager.
- By 2026-12-19, set an out-of-office auto-responder pointing to your team's shared alias.
- No PTO request is required for these days; they are a company holiday, not vacation.
- If you are on a customer escalation or incident pager rotation, the standard rotation continues; speak with your manager about compensation or time-in-lieu.

**FAQ.**

*Does this count against my PTO balance?*
No. Winter shutdown days are company holidays and do not reduce your PTO.

*What if I prefer to work through the shutdown?*
The expectation is that employees do not work. If you have a genuine business need (for example, a regulated deadline), coordinate with your manager and People partner in advance.

*What about on-call and customer-facing teams?*
On-call rotations continue. Affected employees will receive time-in-lieu at a 1:1 ratio, to be taken within the following quarter.

*What about new hires starting in December?*
Anyone with a start date on or before 2026-12-19 is eligible. Later start dates will see the shutdown communicated during onboarding.

*Who do I contact with further questions?*
Your People Partner, or the #ask-people channel in Slack.

— The People team
```

### Example 3: Milestone, casual tone, internal

Input: "We just crossed 10,000 paying customers. Draft a casual internal announcement, signed by the CEO."

Output:

```
# 10,000 paying customers

We crossed 10,000 paying customers this morning. Four years and three months from our first dollar.

The specific customer who got us there: a 12-person design studio in Lisbon who signed up on Monday and upgraded to a team plan this morning. I do not know them, but I am grateful to them, and I am even more grateful to every one of you who built the thing they decided to pay for.

A few numbers that matter more than 10,000:
- 73% of new signups come from existing customer referrals.
- Our NPS is 58, up from 41 this time last year.
- We have had 9 SEV2 incidents this year and 0 SEV1s, with MTTR under an hour.

That's a product people recommend, use, and trust. Thank you — to the engineers and designers who built it, the support team who keeps it running humanely, the sales and success teams who brought the right customers through the door, and everyone doing the work that does not have a cool number attached.

The next milestone is not 20,000 customers. The next milestone is the customer we have not yet figured out how to help. Let's go find them.

— Sofia
```

## Constraints

- **No hype words without data.** "Game-changing," "revolutionary," "best-in-class" require a measurable claim behind them.
- **No vague benefits.** "Streamlined experience," "enhanced productivity" — say what actually changed.
- **Match tone to audience.** Formal for external customers/partners and legal/comp topics; casual OK for internal and product launches.
- **Policy changes always include effective date and what the reader needs to do.**
- **Milestones name a specific number and tell a story.** Vague celebrations do not land.
- **FAQs anticipate real concerns, not softballs.** If you are announcing a pay policy change and the FAQ does not address "does this change my comp?", the FAQ is dishonest.
- **Honesty about the reason.** If a policy change is being made because something went wrong, say that (at the level of detail appropriate for the audience). Do not invent a strategic reason.
- **No exclamation-point inflation.** One maximum per announcement, casual tone only.
- **Do not publish — draft only.** Announcements go through a human signer before they ship.

## Quality checks

Before returning, verify:

- [ ] Announcement type is clear from structure (launch, milestone, or policy change).
- [ ] Tone matches the input (formal vs. casual).
- [ ] Every concrete claim (number, date, name) is sourced or marked for verification.
- [ ] Policy changes include effective date, reason, impact, and FAQ.
- [ ] Launches include a call to action.
- [ ] Milestones include a specific number and a thank-you.
- [ ] No banned hype words without supporting data.
- [ ] Signer is named.
- [ ] Channel-appropriate length (Slack short, email medium, blog long).
