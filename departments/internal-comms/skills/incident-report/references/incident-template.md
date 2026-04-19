# Blameless Postmortem Template

Every incident postmortem uses this structure. The point is to find systemic causes and produce real action items, not to assign blame.

---

## Template

```
# Incident <INC-ID>

| Field | Value |
|---|---|
| Severity | SEV<0-4> |
| Status | Resolved / Mitigated / Monitoring |
| Duration | <X> minutes (<start UTC> – <end UTC>) |
| Impact | <users affected, dollar impact if computable, features affected, customer reports> |
| Incident Commander | @<handle> |
| Comms Lead | @<handle> |
| Scribe | @<handle> |

## Summary
<2–3 sentences. What happened, what was the user impact, how was it resolved.>

## Timeline (UTC)
- HH:MM — <actor> <action>.
- HH:MM — <actor> <action>.

## Detection
- Actual start: <UTC timestamp, from metrics>.
- First alert: <UTC timestamp, alert name, tool>.
- First human ack: <UTC timestamp>.
- Incident declared: <UTC timestamp>.
- Time to detect (actual start → first alert): <X> minutes.
- Time to declare (first alert → declaration): <X> minutes.

## Response
<What we did in mitigation, in order. What worked. What slowed us down. Reference the timeline.>

## Root cause (5 whys)
1. Why did <symptom> happen? <Answer>.
2. Why? <Answer>.
3. Why? <Answer>.
4. Why? <Answer>.
5. Why? <Answer — must be a system or process, not a person>.

## Contributing factors
- <Factor that made the incident worse or longer, but was not the root cause>.
- <Factor>.

## What went well
- <Behavior to reinforce>.
- <Behavior>.

## What did not go well
- <Behavior or gap to change>.
- <Behavior or gap>.

## Action items
| Item | Owner | Due | Ticket | Priority |
|---|---|---|---|---|
| <Specific, verifiable action> | @<handle> | <YYYY-MM-DD> | <TICKET-ID> | P0/P1/P2 |

## Lessons learned
<2–4 sentences of durable insight. What will we design differently next time? What class of mistake is this, not just this mistake?>

## Related incidents
- <INC-ID>: <one-line why it is related>.
```

---

## Filled-out example

```
# Incident INC-2026-03-14-01

| Field | Value |
|---|---|
| Severity | SEV2 |
| Status | Resolved |
| Duration | 47 minutes (2026-03-14T14:12Z – 2026-03-14T14:59Z) |
| Impact | ~3% of /checkout API traffic returned 5xx; estimated $4,200 in delayed or failed revenue (based on $5,400/min average checkout RPM × 47 min × 3% error rate × 55% retry success); 17 customer reports via support. |
| Incident Commander | @bob |
| Comms Lead | @carol |
| Scribe | @erin |

## Summary
A retry loop introduced in order-service v3.22.0 held payments-service connections open for up to 120s per attempt with no timeout, exhausting the payments pool. Customers saw 5xx on ~3% of /checkout calls for 47 minutes. The fix was a revert (PR #4821) deployed at 14:48 UTC; traffic normalized by 14:59 UTC.

## Timeline (UTC)
- 14:08 — CI/CD deployed order-service v3.22.0 (PR #4812).
- 14:10 — First 5xx on /checkout visible in metrics.
- 14:12 — Datadog alert `payments.pool_exhausted > 50/min` fires.
- 14:13 — @alice acks the page, declares SEV2, opens #incident-api-5xx-2026-03-14.
- 14:17 — @bob joins as IC; @carol as comms lead; @erin as scribe.
- 14:22 — Dashboard correlates pool_exhausted spike with order-service deploy at 14:08.
- 14:26 — @dana begins preparing a revert of PR #4812.
- 14:34 — Status page updated: "investigating elevated errors on /checkout."
- 14:38 — Revert PR #4821 opened.
- 14:41 — Revert approved and merged.
- 14:48 — Revert deployed to production.
- 14:54 — pool_exhausted events drop below 5/min.
- 14:59 — /checkout error rate back to baseline; @bob declares incident resolved.
- 15:04 — Status page updated: "resolved."

## Detection
- Actual start: 2026-03-14T14:10Z (first elevated 5xx in metrics).
- First alert: 2026-03-14T14:12Z (`payments.pool_exhausted > 50/min`, Datadog).
- First human ack: 2026-03-14T14:13Z.
- Incident declared: 2026-03-14T14:13Z.
- Time to detect: 2 minutes.
- Time to declare: <1 minute.

## Response
The responders correctly suspected the recent deploy within 12 minutes of the alert and prepared a revert in parallel with investigation. The revert itself was clean. The slowest step was producing the revert PR (12 minutes) because the branch required a fresh CI run. The runbook for "revert last deploy" was out of date and did not mention the fast-track flag for hotfix CI.

## Root cause (5 whys)
1. Why did /checkout return 5xx? Because payments-service returned 500s.
2. Why? Because its connection pool was exhausted (50+ pool_exhausted events/min).
3. Why? Because a new retry loop in order-service held connections open for up to 120s per attempt.
4. Why? Because the retry loop had no per-attempt timeout.
5. Why? Because our code review checklist does not require timeout verification on new outbound calls to internal services, and our shared retry helper does not default to a timeout.

## Contributing factors
- The pool_exhausted alert threshold (50/min) is high enough that by the time it fired, users were already seeing errors for ~2 minutes.
- The CI fast-track flag for hotfix reverts is documented only in a #sre pin from 2025-11, not in the deploy runbook.
- order-service does not have a post-deploy soak period; the bad version went straight to 100% of traffic.

## What went well
- IC, comms, and scribe roles were assigned within 5 minutes of declaration.
- The correlation between the deploy and the symptom was made within 14 minutes.
- Status page was updated proactively before customer pressure forced it.
- Revert-first instinct was correct and fast; no attempt to debug-in-prod delayed mitigation.

## What did not go well
- The retry loop landed without a timeout and without review caught it.
- The alert fired after customer impact had already started.
- The revert CI run took 12 minutes because the fast-track flag was not widely known.

## Action items
| Item | Owner | Due | Ticket | Priority |
|---|---|---|---|---|
| Add per-attempt timeout default to the shared retry helper | @dana | 2026-03-21 | PLAT-501 | P0 |
| Add "outbound call timeout verified" to the code review checklist | @erin | 2026-03-28 | ENG-OPS-88 | P1 |
| Lower pool_exhausted alert to 20/min and add a warn at 10/min | @bob | 2026-03-21 | SRE-204 | P1 |
| Add 15-minute post-deploy soak for order-service (10% → 100%) | @dana | 2026-04-04 | PLAT-502 | P2 |
| Update deploy runbook with CI fast-track flag for reverts | @alice | 2026-03-25 | ENG-OPS-89 | P2 |

## Lessons learned
Timeouts on outbound calls are a checklist item, not a judgment call. Any code path that can hold a pooled resource must also be able to give it back within a bounded time. Separately, our alerts currently fire after user-visible impact; we should tune toward leading indicators (pool utilization %, queue depth) rather than only fault counts.

## Related incidents
- INC-2025-11-02-03: similar pool exhaustion in notifications-service caused by a 3rd-party webhook call without timeout. Same class of root cause; action items from that incident targeted only notifications-service rather than the shared helper.
```

---

## Notes on using this template

- **Timeline is facts, not narrative.** One line per event. No prose paragraphs inside the timeline.
- **Impact must be quantified.** "Some users" is not impact. Use metrics, or mark "unknown" and add an action item.
- **5 whys must bottom out in a system or process.** If it bottoms out in a person, keep asking.
- **"What went well" is not optional.** Postmortems that only list failures punish the team for showing up and learning.
- **Action items without an owner are not real.** If no one will own it, it will not happen. Flag it for the review meeting instead of creating ghost work.
- **Priority is relative to the team, not absolute.** P0 means "the next thing this team does." P1 means "inside the next 2 weeks." P2 means "scheduled and tracked."
