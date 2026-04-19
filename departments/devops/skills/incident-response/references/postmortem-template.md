# Postmortem Template

Blameless. Systems-focused. UTC timestamps.

---

## Summary

One paragraph. What happened, who was affected, how long, what fixed it. Should be understandable by a product manager.

> Example: On 2026-04-19 between 14:32 and 15:28 UTC (56 minutes), roughly 10% of checkout requests returned HTTP 500. A regression in `checkout-api` v1.4.2 that dereferenced a null optional header caused a crash loop in new pods. The on-call rolled back to v1.4.1 at 15:24 UTC and traffic recovered within 4 minutes.

## Impact

- **User impact:** quantified (e.g. 56 minutes of 10% failed checkouts = ~3,200 affected orders).
- **Revenue impact:** estimated (order $ / min * minutes * failure rate).
- **SLO impact:** how much of the monthly error budget was consumed.
- **Data impact:** any corruption, dropped writes, or inconsistent state. If none, say so explicitly.
- **Downstream impact:** other teams/services paged or affected.

## Severity

SEV{1,2,3,4} with the definition that was matched at time of declaration, and the final confirmed severity (these can differ).

## Timeline (UTC)

Use a table. Every entry has a timestamp and an actor (person or system).

| Time (UTC) | Actor | Event |
|------------|-------|-------|
| 14:30 | CI | `deploy.yml` run #482 merged v1.4.2 to prod. |
| 14:32 | Alertmanager | `checkout-api error rate > 2%` fired to PagerDuty. |
| 14:34 | @alice | Acknowledged page, opened `#inc-20260419-checkout-5xx`. |
| 14:38 | @bob | Identified crash loop on new ReplicaSet; NPE in logs. |
| 14:42 | @alice | Declared SEV2, posted initial Slack update. |
| 14:55 | @bob | `helm rollback checkout-api 37` issued. |
| 15:02 | @bob | Rollback complete; old ReplicaSet serving 100% traffic. |
| 15:28 | @alice | Error rate below 0.1% for 10 minutes; resolved. |
| 15:30 | @alice | Status page marked resolved, customers notified. |

## Detection

- How did we find out? (alert, customer report, internal dogfood.)
- Time-to-detect from first impact: X minutes.
- Was the signal the right one? If alert fired: was threshold appropriate, or should it be tighter?
- If a customer reported it first: what alert should have caught it and why didn't it?

## Response

- Time-to-acknowledge: X minutes.
- Time-to-mitigate from detection: X minutes.
- Was the on-call rotation correct? Did the right SME get pulled in?
- Did our runbooks cover this scenario?
- Which tools slowed us down? Which helped?

## Root cause

One or two paragraphs on the actual cause. Technical specifics. Include code snippets, graphs, or log excerpts.

> Example: `GET /checkout` parses the optional `X-Forwarded-For` header to populate the audit log. v1.4.2 changed the parser from `Option<String>` to `String` and dereferenced without a null check. Any request that did not set the header caused a panic. Staging traffic always routes through the internal LB, which injects the header; production traffic arrives via Cloudflare with the header optional.

## Contributing factors

List the conditions that allowed the root cause to land in production. Usually 3-6 items.

- Staging does not see unheader-ed traffic — test gap.
- Code review did not flag the removal of `Option` — reviewer guidance gap.
- Canary traffic sample (5%) did not include clients without the header — monitoring gap.
- No contract test against the real upstream (Cloudflare) header behavior.
- The SLO alert fired after 5 minutes, not after 1 — alerting latency.

## What went well

Be specific. This is not filler; it is how we know what to keep.

- On-call ack within 2 minutes at 14:32 UTC.
- Helm history made rollback a single command.
- Scribe captured timestamps in-channel so the timeline above required no reconstruction.

## What went poorly

- Canary gate passed because the sampled requests all had the header.
- It took 16 minutes from ack to rollback because the on-call first tried to forward-fix.
- Status page was updated 9 minutes after Slack — should be simultaneous.

## Action items

Every action has: title, owner, due date, priority. Add them to the tracker *during* postmortem review, not after.

| # | Action | Owner | Due | Priority |
|---|--------|-------|-----|----------|
| 1 | Add contract test for missing `X-Forwarded-For` in checkout-api. | @eng-checkout | 2026-04-26 | P0 |
| 2 | Canary gate must sample both header-present and header-absent requests. | @platform | 2026-05-03 | P0 |
| 3 | Runbook: default action on deploy-correlated 5xx spike is rollback, not forward fix. | @alice | 2026-04-22 | P1 |
| 4 | Statuspage update hook on Slack `:rotating_light:` emoji in `#inc-*`. | @comms | 2026-04-30 | P2 |
| 5 | SLO alert window from 5m to 2m for error rate. | @platform | 2026-05-10 | P1 |

## Lessons

Bullet the generalizable takeaways. Aim for 3-5. These feed into future training, onboarding, and hiring rubrics.

- Canary sampling must reflect the full shape of prod traffic, not a uniform sample.
- "Optional in the wire protocol" should be treated as a typed invariant with tests, not a code-review checkpoint.
- Rollback is always the first mitigation for a deploy-correlated incident; forward fixes are for after the clock stops.
- Scribes in-channel are cheap and save a day of postmortem archaeology.

## Appendix

- Links to: Slack channel, PagerDuty incident, status page update, dashboards snapshot, relevant PRs, CI runs.
- Raw metric queries used during triage (so future incidents can reuse them).
- Any relevant screenshots of graphs at the moment of peak impact.
