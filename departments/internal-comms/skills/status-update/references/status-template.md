# Weekly Status Update Template

Use this template for every weekly status. Keep the structure identical so readers can skim. Target 250–350 words total.

---

## Template

```
# Week of <YYYY-MM-DD> — <Team Name>

**TL;DR:** <One sentence. The single most important thing a reader should leave with.>

## Shipped
- <Feature / change> (<TICKET-ID>): <user or business impact, not feature name>.
- <Feature / change> (<TICKET-ID>): <impact>.

## In flight
- <Initiative> (<TICKET-ID>): <percent>% — <what was done this week>. ETA <date>.
- <Initiative> (<TICKET-ID>): <percent>% — <what was done this week>. ETA <date>.

## Next week
- <Specific deliverable>.
- <Specific deliverable>.
- <Specific deliverable>.

## Risks and blockers
- <Risk>: <why it is a risk>. Mitigation: <what we are doing> OR Ask: <who we need help from>.

## Asks
- @<Person or Team>: <specific request> by <date>.

## Metrics (optional)
- <Metric name>: <this week> (<delta vs last week>).
```

---

## Filled-out example

```
# Week of 2026-04-19 — Platform team

**TL;DR:** Shipped auth token rotation and cut p99 latency by 38%; Postgres 16 upgrade is blocked on an AppSec review open for 11 days.

## Shipped
- Auth token rotation (PLAT-412): reduced the forged-token exposure window from 24h to 15min. Rolled to 100% of traffic on 2026-04-17.
- Redis connection pooling (PLAT-398): p99 API latency dropped from 340ms to 210ms after rollout on 2026-04-15.
- Deprecated `/v1/users` endpoint removed (PLAT-409): 4 months post-deprecation, 0 remaining callers in the last 30 days of access logs.

## In flight
- Postgres 16 upgrade (PLAT-377): 60% — schema migration landed, canary holding at 5%. ETA slipped from 2026-04-19 to 2026-04-26.
- Internal rate-limit dashboard (PLAT-431): 40% — Grafana scaffolding merged, three of seven panels populated. ETA 2026-04-30.
- Multi-region failover RFC (PLAT-440): in review — first draft circulated Tuesday, comments due 2026-04-22.

## Next week
- Unblock and complete the Postgres 16 canary-to-100% rollout.
- Ship v1 of the rate-limit dashboard to the on-call rotation.
- Incorporate RFC feedback and pick a primary failover strategy.
- Start the spike for background-job retry budgets (PLAT-444).

## Risks and blockers
- Postgres 16: AppSec review (SEC-204) open 11 days with no response. Mitigation: posted twice in #sec-review; escalating to Priya (AppSec lead) Monday. Ask: route SEC-204 to an owner this week.
- Rate-limit dashboard: depends on the metrics pipeline v2 shipping by 2026-04-25. If it slips, dashboard ETA moves to 2026-05-07.

## Asks
- @AppSec (Priya): please assign an owner to SEC-204 by 2026-04-22.
- @Data (Marco): confirm your breaking-change inventory for Postgres 16 matches ours by 2026-04-23. Ours is in PLAT-377, comment 14.
- @SRE: review the multi-region RFC by 2026-04-22 — specifically the failover trigger section.

## Metrics
- p99 API latency: 210ms (-38% WoW).
- Open SEV2 incidents: 1 (+0 WoW).
- PRs merged: 23 (+4 WoW).
```

---

## Notes on using this template

- **TL;DR** is the only section every reader will read. Make it the single most load-bearing sentence.
- **Shipped bullets must lead with impact, not feature name.** "Cut p99 latency by 38%" beats "shipped Redis pooling."
- **Percent complete for in-flight items** should come from a real source (subtask count, a PM's estimate, a burn-down). Do not fabricate it. "In review" is a valid alternative.
- **Risks without mitigation or an ask are not risks**, they are venting. Force yourself to name either what you are doing about it or who needs to help.
- **Asks should be uncomfortable to write.** If every ask is "please take a look when you get a chance," you have not actually asked for anything. Name a person, name a date, name a concrete deliverable.
- **Metrics are optional and must be real.** If the team does not track a metric weekly, skip the section entirely rather than inventing one.
- **If a "next week" item from last week did not ship**, either move it to "In flight" with honest ETA, or drop it with a one-line reason in "Risks."
