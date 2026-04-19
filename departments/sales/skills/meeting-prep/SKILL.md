---
name: meeting-prep
description: Use when a rep has a customer meeting booked and needs a pre-meeting brief. Produces a one-page dossier with company context, attendee LinkedIn profiles and recent activity, role-based priorities, a draft agenda, talking points tied to research, anticipated objections, and a defined success metric.
---

## When to use

Trigger this skill when:

- A first meeting is booked with a new account and the rep needs prep within 24 hours.
- A second meeting with new attendees (e.g. a technical evaluator added) needs incremental prep.
- A critical stage-gate meeting (exec alignment, procurement kickoff, QBR) is on the calendar.
- A renewal conversation requires context on the customer's last 12 months.

Do not use this for internal meetings or for first-touch cold prospecting — use `lead-research` for outbound prep.

## Inputs

Required:

- `meeting_context` — date/time, meeting purpose, expected length.
- `attendees` — list of attendees with name, title, and company. Email addresses help for disambiguation.
- `company_name` — the customer or prospect company.

Optional but recommended:

- `calendar_invite` — if parseable, extracts attendees automatically.
- `prior_touches` — emails, call notes, Gong summaries from previous conversations.
- `research_brief` — if `lead-research` has already been run, pass its output.
- `deal_stage` — early / mid / late, affects the agenda shape.
- `our_goal` — what we want to leave the meeting with (e.g. "MSA redlines returned," "champion agrees to intro CISO").

## Outputs

A one-page Markdown brief:

1. **Meeting header** — who, when, purpose, duration.
2. **Our success metric** — one sentence defining what a successful meeting looks like.
3. **Company snapshot** — 3-5 lines (pulled from or compressed from `research_brief`).
4. **Attendees** — per person: title, tenure, prior companies, recent LinkedIn activity, inferred priorities.
5. **Likely priorities by role** — for each attendee, 2-3 priorities based on their role and tenure.
6. **Draft agenda** — time-boxed segments with owners.
7. **Talking points** — 3-5 points tied to research, each with a supporting artifact to reference.
8. **Anticipated objections** — 2-4 objections likely to surface, with responses.
9. **Risks to the meeting** — what could derail it, with mitigation.
10. **Actions / follow-up plan** — what we intend to commit to.

## Tool dependencies

- **WebSearch** / **WebFetch** — required. Pulls LinkedIn profiles and recent activity.
- **Google Calendar MCP** — optional but very useful; extracts attendees and timing from the invite.
- **Salesforce** / **HubSpot MCP** — optional; pulls prior deal history and notes.
- **Gong** / **Chorus** (if MCP available) — optional; pulls summaries of prior calls with this account.
- **Notion MCP** — optional; pulls case studies and internal playbooks to reference.

## Procedure

1. **Resolve the attendees.** For each, confirm LinkedIn profile URL. Disambiguate common names using the company + title.
2. **Pull per-attendee context**:
   - Tenure at current company.
   - Prior companies and roles.
   - Posts/articles/comments from the last 60 days.
   - Relevant conference talks.
   - Anything mutual — shared connections, shared past employer, shared conference.
3. **Infer role priorities.** Use the role + tenure heuristic:
   - New in seat (<6 months) → focused on visible wins, 100-day plan.
   - Long-tenured (>3 years) → focused on incremental improvement, risk management.
   - Role-specific defaults: CISO priorities differ from CRO priorities; list 2-3 per attendee.
4. **Compress company snapshot.** If `research_brief` exists, summarize to 5 lines. If not, run a mini-version of the research pattern.
5. **Draft the agenda.** Structure depends on meeting type:
   - Discovery: 5 min intros / 20 min their context / 20 min our view / 10 min next steps.
   - Demo: 5 min intros / 5 min frame / 30 min demo / 15 min Q&A / 5 min next steps.
   - Exec alignment: 5 min intros / 10 min progress / 15 min decisions needed / 5 min next steps.
6. **Write talking points.** Each point names a trigger or insight from research, and an artifact to reference (a case study, a data point, a diagram).
7. **Anticipate objections.** Based on the attendees' roles and the stage: CFO will ask about ROI timeline, CISO will ask about data residency, VP Eng will ask about API rate limits. Write a short response per objection, tied to evidence.
8. **Identify meeting risks.** Common risks: the real decision maker won't be there; a surprise attendee from a competing team; timeline compression. For each, state a mitigation.
9. **Define the success metric.** One sentence. "Success = champion agrees to schedule security-team intro within 5 business days." Vague success metrics produce vague meetings.
10. **List intended follow-ups.** What will we commit to sending? Who owns each?

## Examples

### Example 1 — discovery call with Acme Retail

Inputs: Meeting booked for Thursday, 30 minutes, discovery. Attendees: Priya Shah (VP Data, Acme Retail, 6 weeks in role) and Luis Ortega (Director, Data Engineering, 2 years in role). Our goal: get invited to a follow-up working session with their head of engineering.

Output excerpt:

> **Success metric**: Priya agrees to a 60-minute architecture working session within the next 14 days with Luis and her head of engineering.
>
> **Attendees**
>
> - **Priya Shah** — VP Data, 6 weeks in role, ex-Warby Parker (Director, Data Platform). LinkedIn activity: commented on 2026-03-18 on a post about real-time CDPs saying "this is exactly the architecture we're building at Acme." Mutual connection: Jordan Lee, our SE, worked with her at Warby Parker.
> - **Luis Ortega** — Director, Data Engineering, 2 years at Acme. Posted about dbt model performance 2026-02-22. Prior: 4 years at Shopify Plus partner agency.
>
> **Likely priorities**
>
> - **Priya**: (1) visible 100-day plan she can show the board; (2) hiring her team without bottlenecking roadmap; (3) defending the Snowflake-based architecture she's inheriting.
> - **Luis**: (1) reducing pipeline toil; (2) managing dbt model sprawl; (3) not being the bottleneck during the CDP rollout.
>
> **Talking points**
>
> 1. Warby Parker's 90-day rollout — ref Jordan's direct experience. Supporting: the teardown deck.
> 2. Managed pipeline vs. in-house — specifically addresses Luis's hiring gap. Supporting: the staffing model doc.
> 3. Real-time latency benchmarks on Shopify + Snowflake stacks — 45s median. Supporting: the benchmark PDF.
>
> **Anticipated objections**
>
> - "We already have Segment." → Acknowledge; reframe around activation latency and identity resolution; redirect to a benchmark comparison.
> - "We'd rather build this ourselves." → Acknowledge; reframe around time-to-first-value; redirect to the shared 90-day plan at Warby Parker.
>
> **Risks**
>
> - Priya may bring an unannounced attendee from procurement. Mitigation: ask at the top "anyone else planning to join?"
> - 30 minutes is tight. Mitigation: pre-send the one-pager and propose extending to 45.

### Example 2 — late-stage exec alignment with Nimbus Logistics

Inputs: Meeting is between their new CIO and our CRO. Deal is 6 weeks into a 12-week evaluation. Success metric: CIO commits to an expedited procurement path. Output brief emphasizes the CIO's stated "consolidate visibility spend" priority, names their stalled Project44 renewal as a forcing function, and pre-empts the likely CFO ROI objection with a specific 14-month payback model.

## Constraints

- The brief fits on one page (roughly 500-700 words). Longer briefs don't get read.
- Every talking point names a specific artifact to reference. No "we should bring up value."
- Every objection response follows Acknowledge → Reframe → Redirect.
- Success metric is a single sentence with a concrete verb and a date ("agrees to schedule X by [date]").
- Attendee sections cite sources for non-LinkedIn claims (e.g. conference talk URL).
- Do not invent attendee details. If LinkedIn is private, say so.
- No emojis.

## Quality checks

Before returning:

- [ ] Header includes meeting time in local timezone with date.
- [ ] Success metric is a single sentence with a specific, verifiable outcome.
- [ ] Every attendee has tenure, prior company, and at least one piece of recent activity (or explicit "no recent public activity").
- [ ] Each attendee has 2-3 inferred priorities.
- [ ] Draft agenda is time-boxed and sums to the meeting length.
- [ ] Each talking point names the artifact to bring.
- [ ] At least 2 anticipated objections, each with a reframe.
- [ ] At least one meeting risk is named with a mitigation.
- [ ] Follow-up actions have named owners.
- [ ] Brief fits on one printed page.
