---
name: meeting-notes
description: Use when given a meeting transcript (Otter, Granola, Zoom, Google Meet, or manually typed) and need structured notes. Extracts decisions, action items with owner and deadline, open questions, and key points — omits small talk and verbatim transcription.
safety: writes-local
---

## When to use

Trigger this skill when:

- A meeting has ended and someone needs to distribute notes to attendees and non-attendees.
- A transcript exists (from Otter, Granola, Fireflies, Zoom AI, Google Meet, or a scribe) and you need to distill it.
- A recurring meeting (staff, 1:1, design review) needs notes captured in a consistent format.

Do **not** use this skill for:

- Legal-grade records where verbatim matters (depositions, disputes) — use the raw transcript.
- Interview notes where the content *is* the notes (qualitative research) — use a research-specific template.
- Notes from a meeting you did not have a transcript for — ask the user for their rough notes first.

## Inputs

Required:

- **Transcript** (pasted, file path, or link to Otter/Granola).
- **Meeting name** and **date** (UTC).

Optional:

- **Attendees list** (names and roles). If not provided, the skill will extract speakers from the transcript and ask about roles.
- **Agenda** (if one was circulated).
- **Prior meeting notes** (for recurring meetings — helps track follow-through on previous action items).

## Outputs

A Markdown document following the structure in `references/meeting-template.md`:

1. **Meeting** name and **Date** (UTC)
2. **Attendees** (with roles)
3. **Agenda** (if provided)
4. **Decisions** — explicit yes/no decisions only
5. **Action Items** — each with owner (named person) and due date
6. **Open Questions** — things raised but not resolved
7. **Discussion Notes** — bullet summary, not verbatim
8. **Next Meeting** — date and agenda items carried forward

## Tool dependencies

- **Read** — to load transcript files.
- **Google Calendar MCP** (optional) — to resolve attendee list and meeting time from the calendar invite.
- **Notion MCP** (optional) — to write the notes into a meetings database and link to prior meetings.
- **Slack MCP** (optional) — to post the notes summary into the team channel.

## Procedure

1. **Parse the transcript.** Identify speaker turns. If the transcript is from Otter/Granola, these are typically tagged; if raw, infer from context or ask.
2. **Resolve attendees.** If not provided, list every distinct speaker. Match to the calendar invite if available. Tag each with their role.
3. **Identify decisions.** A decision is an explicit yes/no or pick-A-or-B moment. Look for:
   - "Let's go with X."
   - "Decided: we will..."
   - "Agreed, X by Y."
   - The end of a debate where one option is adopted.
   A comment like "maybe we should..." is NOT a decision — it is a possible action item or an open question.
4. **Extract action items.** An action item must name a **person** and a **date**.
   - "Alice will send the doc" → action item if a date can be inferred ("by end of week"), otherwise move to Open Questions with a note to confirm owner+date.
   - "Someone should look at this" → NOT an action item. Flag as Open Question.
   - Implicit due dates ("before next meeting," "this week") should be resolved to a concrete date based on the meeting date.
5. **Identify open questions.** Things that were raised, discussed inconclusively, and not converted into a decision or action item. Each should be one sentence, phrased as a question.
6. **Summarize discussion.** For each agenda item (or each major topic if no agenda), write 2–5 bullets. Each bullet is a *point made*, not a *line spoken*. Combine repeated points. Omit:
   - Greetings, goodbyes, small talk.
   - Technical hiccups ("can you hear me?").
   - Off-topic tangents unless they led to a decision or action item.
7. **Check follow-through.** If prior meeting notes were provided, list which of the previous action items shipped, slipped, or are still in progress.
8. **Identify next meeting.** Date, owner, and any agenda items explicitly carried forward.
9. **Draft the notes.** Enforce the structure. Keep it scannable.
10. **Return** for human review. Recommend sharing with attendees for corrections before publishing.

## Examples

### Example 1: Weekly design review, Otter transcript

Input: "Here is the Otter transcript from today's design review, 2026-04-17. Attendees: Dana (design lead), Marco (PM), Priya (eng), Sam (research)."

Output (excerpt):

```
# Design Review — 2026-04-17

**Date:** 2026-04-17 (16:00–16:45 UTC)
**Attendees:**
- Dana (Design Lead)
- Marco (PM)
- Priya (Engineering)
- Sam (Research)

## Decisions
- Ship the onboarding redesign with the 3-step flow, not 5-step. Rationale: Sam's usability study showed 5-step drove 18% drop-off at step 3.
- Move the "skip for now" CTA to secondary styling, not primary.

## Action Items
- **Dana:** produce final Figma for the 3-step flow by 2026-04-22.
- **Priya:** estimate implementation cost for the 3-step flow by 2026-04-23.
- **Sam:** share the raw usability study data with Marco by 2026-04-18.
- **Marco:** draft the GTM note for the redesign launch by 2026-04-25.

## Open Questions
- Should first-time users who land via a marketing link skip the onboarding entirely, or see an abbreviated version?
- What is the rollout plan — 100% at launch, or ramp from 10%?

## Discussion Notes
- Sam presented usability findings from n=12 sessions. 5-step flow drove 18% drop at step 3 (address entry).
- Dana proposed collapsing address entry and payment into one step; Priya flagged this adds complexity to validation error states.
- Group agreed that the 3-step flow (account, address+payment, confirm) is the right shape, but validation error UX needs its own review.
- Marco raised GTM timing — launch needs to land before the 2026-05 campaign.

## Next Meeting
- 2026-04-24, 16:00 UTC.
- Carried forward: validation error UX review (Dana to bring).
```

### Example 2: 1:1 transcript with no agenda

Input: "Here's a rough transcript of my 1:1 with my manager today. We talked about my project and career stuff."

Output: same structure, but Agenda is marked "none circulated" and Decisions may be empty. Action items lean toward the report ("I will draft a scope doc by Friday"). Discussion Notes are more narrative. Sensitivity flag: the skill should ask whether the notes are for the report's eyes only before writing anywhere shared.

## Constraints

- **Action items must name a person and a date.** If either is missing, it is an open question, not an action item.
- **Decisions must be explicit.** Do not promote a suggestion to a decision. If you are unsure, put it in Open Questions.
- **No verbatim quoting** unless a specific phrase was load-bearing to a decision. Keep the notes one layer of abstraction above the transcript.
- **No small talk, technical hiccups, or off-topic tangents** in Discussion Notes.
- **Times in UTC.** Dates in ISO format `YYYY-MM-DD`.
- **Do not name-and-shame.** If a person was repeatedly pushing against a decision that was adopted, do not record "X objected but was overruled." Record the decision and the rationale, not the politics.
- **Sensitive content requires confirmation.** For 1:1s, performance discussions, and compensation topics, ask before writing anywhere the wrong audience might see.

## Quality checks

Before returning, verify:

- [ ] Every action item has an owner (named person) and a due date (YYYY-MM-DD).
- [ ] Every decision is an explicit yes/no or pick-A-or-B, with a one-phrase rationale.
- [ ] Open Questions are phrased as questions.
- [ ] Discussion Notes are bullets, not paragraphs; no verbatim quotes unless load-bearing.
- [ ] No small talk, greetings, or "can you hear me" noise.
- [ ] Attendees have names and roles.
- [ ] If prior notes were provided, follow-through is noted.
- [ ] Meeting date is in UTC, ISO format.

See `references/meeting-template.md` for the full template with a worked example.
