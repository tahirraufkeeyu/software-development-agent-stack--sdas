# Meeting Notes Template

Every meeting's notes use this structure. Readers should be able to answer "what was decided, what am I supposed to do, and what is still open" in under 60 seconds.

---

## Template

```
# <Meeting Name>

**Date:** <YYYY-MM-DD> (<HH:MM>–<HH:MM> UTC)
**Attendees:**
- <Name> (<Role>)
- <Name> (<Role>)

**Absent (invited):**
- <Name> (<Role>)

## Agenda
1. <Topic>
2. <Topic>

## Decisions
- <Explicit decision>. Rationale: <one phrase>.

## Action Items
- **<Owner>:** <specific action> by <YYYY-MM-DD>.

## Open Questions
- <Question>?

## Discussion Notes
### <Topic 1>
- <Point>.
- <Point>.

### <Topic 2>
- <Point>.

## Follow-through on prior action items (optional)
- <Owner> — <prior action>: <shipped / slipped / in progress>.

## Next Meeting
- **Date:** <YYYY-MM-DD> <HH:MM> UTC.
- **Carried forward:** <topic> (<owner>).
```

---

## Filled-out example

```
# Platform Team Weekly Sync

**Date:** 2026-04-17 (15:00–15:55 UTC)
**Attendees:**
- Bob (Engineering Manager)
- Alice (Senior Engineer, on-call)
- Dana (Engineer)
- Erin (Engineer)
- Priya (AppSec, guest)
- Marco (Product, guest)

**Absent (invited):**
- Sam (Engineer, OOO)

## Agenda
1. Postgres 16 upgrade status and SEC-204
2. Rate-limit dashboard demo
3. Multi-region RFC feedback
4. On-call rotation for the upcoming holiday week

## Decisions
- Postgres 16 canary will stay at 5% until SEC-204 is signed off, not moved to 25% on Monday. Rationale: security review open 11 days; moving up the canary without signoff violates the deploy policy for schema changes.
- Rate-limit dashboard v1 ships to on-call only, not the whole team, by 2026-04-30. Rationale: feedback loop is tighter with the five on-call engineers.
- Multi-region RFC will adopt active-passive failover, not active-active, for v1. Rationale: active-active doubles the cost and solves a problem (sub-second failover) we do not have.
- Holiday week on-call: Dana primary, Erin secondary, Alice as escalation. Rationale: Bob is OOO; Dana volunteered; Erin has not had a primary rotation yet and wants one.

## Action Items
- **Bob:** escalate SEC-204 to Priya's manager by 2026-04-21 if no progress.
- **Priya:** confirm owner assignment for SEC-204 by 2026-04-22.
- **Dana:** ship rate-limit dashboard v1 to on-call by 2026-04-30.
- **Erin:** incorporate RFC comments and post v2 of the multi-region RFC by 2026-04-24.
- **Alice:** write the holiday-week runbook delta (what's different) by 2026-04-28.
- **Marco:** confirm whether the 2026-05 campaign depends on Postgres 16 being done by 2026-04-22.

## Open Questions
- If SEC-204 signoff slips past 2026-04-28, do we pause the upgrade or raise the canary without signoff?
- Should we build a staging-region for multi-region testing, or rely on production canaries?
- Who owns the migration playbook for downstream teams affected by the Postgres 16 connection string change?

## Discussion Notes

### Postgres 16 upgrade status
- Canary has been stable at 5% for 4 days; no errors, latency profile matches v15.
- SEC-204 is the only blocker. Priya confirmed her team is under-staffed this sprint.
- Group discussed the tradeoff of pausing vs. raising canary without signoff; agreed the security policy wins and we pause if needed.

### Rate-limit dashboard demo
- Dana walked through the five panels now populated.
- On-call engineers will see per-service utilization and can drill into spikes from the last 24h.
- Missing: per-customer breakdown. Not on the v1 scope; filed as PLAT-445 for v2.

### Multi-region RFC
- Erin summarized the tradeoffs. Three variants: active-active, active-passive, passive-passive-with-warmup.
- Cost delta: active-active ~2.1x; active-passive ~1.4x; passive-passive ~1.1x but with 3-5 min failover.
- Priya raised the data residency implications for EU traffic; not resolved — flagged as an open question in the RFC.
- Group preferred active-passive as the v1 target, with a v2 path to active-active if data suggests it.

### Holiday week on-call
- Standard escalation chain does not apply because Bob is OOO.
- Dana volunteered for primary; Erin volunteered for secondary to get the experience.
- Alice will be available as the escalation path and will write up what is different from a normal week.

## Follow-through on prior action items (from 2026-04-10)
- Alice — draft the on-call runbook for retry-storm scenarios: shipped (PLAT-439 merged 2026-04-15).
- Dana — rate-limit dashboard Grafana scaffolding: shipped.
- Bob — schedule 1:1s with Marco about Postgres timing: slipped, rescheduled to 2026-04-18.

## Next Meeting
- **Date:** 2026-04-24, 15:00 UTC.
- **Carried forward:** SEC-204 status (Bob), RFC v2 (Erin), holiday-week runbook (Alice).
```

---

## Notes on using this template

- **If there are no decisions, leave the section in but write "None."** Do not inflate suggestions into decisions to fill the section.
- **Action items are the most-read section.** Every attendee will scan for their name. Keep them short, specific, and dated.
- **Discussion Notes are bullets, not transcripts.** If you find yourself writing a paragraph, it probably belongs in a doc that this meeting produced, not in the notes.
- **Follow-through is optional but recommended for recurring meetings** — it closes the loop and makes the meeting feel consequential.
- **Sensitive meetings (1:1s, performance, comp):** confirm the audience before writing the notes anywhere shared. The template still applies, but distribution is different.
