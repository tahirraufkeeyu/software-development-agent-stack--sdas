---
name: incident-report
description: Use when an incident has been resolved and a blameless postmortem is needed. Reconstructs the timeline from Slack `#incident-*` channels, logs, and PagerDuty, then drafts a structured postmortem with 5-whys root cause analysis and owner-assigned action items.
---

## When to use

Trigger this skill when:

- An incident (any severity) has been declared resolved and the team needs a written postmortem.
- A customer or leadership stakeholder has asked for a writeup of what happened.
- A recurring issue needs a formal record to spot patterns across incidents.

Do **not** use this skill for:

- Mid-incident communication (use `engineering:incident-response`).
- Security vulnerability disclosure to external parties (follow the formal security process).
- Routine bug triage notes (use a ticket, not a postmortem).

## Inputs

Required:

- **Incident ID** (e.g., `INC-2026-03-14-01`) or the Slack channel name (e.g., `#incident-api-5xx-2026-03-14`).
- **Start and end timestamps** of the incident (UTC preferred).
- At minimum one source of truth: Slack channel transcript, PagerDuty incident link, or log excerpts.

Optional:

- Links to dashboards, commit SHAs of the change that introduced the issue, and the revert PR.
- Names and roles of the responders (IC, comms lead, scribe).
- Prior related incidents.

## Outputs

A single Markdown postmortem following the structure in `references/incident-template.md`:

1. Header with incident ID, severity, status, duration, impact summary
2. One-paragraph summary (2–3 sentences)
3. Timeline in UTC (who did what, when)
4. Detection (how did we find out, how long until detection)
5. Response (what we did, what worked, what did not)
6. Root cause analysis with 5 whys
7. Contributing factors
8. What went well / what did not
9. Action items table: Item | Owner | Due | Ticket | Priority
10. Lessons learned
11. Related incidents

## Tool dependencies

- **Slack MCP** — `slack_read_channel`, `slack_search_public` to pull the incident channel transcript in order.
- **PagerDuty MCP** (if available) — for incident start/end timestamps, severity, and responder list.
- **GitHub MCP** — to find the offending PR (via `git bisect` or by searching for the revert commit) and the resolving PR.
- **Bash** — `git log --before --after` to scope commits around the incident.
- **Grep / Read** — to pull log excerpts from local files if logs were exported.

## Procedure

1. **Gather inputs.** Confirm the incident ID, severity, channel, and timestamp window. If any are missing, ask before proceeding.
2. **Pull the Slack timeline.** Read the incident channel from declaration to resolution. Extract every message with a timestamp, author, and a factual claim. Discard reactions, jokes, and "ack" acknowledgments unless they mark a handoff.
3. **Normalize to UTC.** Convert all timestamps to UTC. Use ISO-8601 format `2026-03-14T14:23:00Z`.
4. **Build the timeline.** Each entry: `HH:MM UTC — <actor> <action>`. Merge adjacent messages from the same actor describing the same action.
5. **Compute impact.** Duration (end minus start), affected users (from metrics, not estimates), dollar impact if computable (RPM × outage minutes × affected %), affected features, customer reports count.
6. **Detection analysis.** First alert time, first human acknowledgment time, time to declare incident. Compute time-to-detect = first-alert minus actual-start (use metrics to find actual start; this is often earlier than the alert).
7. **Root cause — 5 whys.** Start with the observable symptom. Ask "why" five times. Each "why" should point at a condition, not a person. Example:
   - Symptom: API returned 5xx on 3% of `/checkout` calls.
   - Why 1: The payments service was returning 500s.
   - Why 2: Its connection pool was exhausted.
   - Why 3: A new retry loop in the order service held connections open too long.
   - Why 4: The retry loop had no timeout.
   - Why 5: The code review checklist does not require timeout verification on new outbound calls.
8. **Contributing factors.** Things that made it worse but are not the root cause: stale alert threshold, on-call paged the wrong person first, runbook was outdated, etc.
9. **What went well / what did not.** Two balanced lists. "What went well" is not optional — the purpose is to reinforce behaviors.
10. **Action items.** Every action item has an **owner (named person), a due date (real), a ticket (created or linked), and a priority (P0/P1/P2)**. If you cannot assign an owner, the action item is not real; flag it for the incident review meeting.
11. **Blamelessness pass.** Re-read the draft. Rewrite any sentence that names a person in a causal role ("X deployed the bug") into a systemic one ("the change was deployed without a staging soak period because the deploy pipeline does not enforce one for hotfixes").
12. **Return** the draft for human review. Recommend a postmortem review meeting before publication.

## Examples

### Example 1: SEV2 API outage, Slack + GitHub available

Input: "Write the postmortem for INC-2026-03-14-01. Channel is `#incident-api-5xx-2026-03-14`. It started at 14:12 UTC and was resolved at 14:59 UTC."

Output (excerpt):

```
# Incident INC-2026-03-14-01

| Field | Value |
|---|---|
| Severity | SEV2 |
| Status | Resolved |
| Duration | 47 minutes (2026-03-14 14:12 – 14:59 UTC) |
| Impact | ~3% of API traffic returned 5xx on /checkout; estimated $4,200 in delayed or failed revenue; 17 customer reports |

## Summary
At 14:12 UTC a new retry loop deployed to the order service exhausted the payments service connection pool, returning 5xx on ~3% of /checkout calls for 47 minutes. The fix was a revert of PR #4812, deployed at 14:54 UTC; traffic normalized by 14:59 UTC.

## Timeline (UTC)
- 14:08 — order-service v3.22.0 deployed (PR #4812).
- 14:12 — Datadog alert: payments-service pool_exhausted > 50/min.
- 14:13 — @alice acks page, declares SEV2, opens #incident-api-5xx-2026-03-14.
- 14:17 — @bob joins as IC; @carol as comms lead.
- 14:22 — Graph confirms pool exhaustion correlates with order-service deploy at 14:08.
- 14:38 — Revert PR #4821 opened.
- 14:48 — Revert merged and deployed.
- 14:54 — Pool utilization drops below threshold.
- 14:59 — Error rate back to baseline; incident resolved.

## Detection
- Actual start: 14:10 UTC (first 5xx in metrics).
- First alert: 14:12 UTC (2 min to detect).
- Incident declared: 14:13 UTC (1 min from alert to declaration).

## Root cause (5 whys)
1. Why did /checkout return 5xx? The payments service returned 500s.
2. Why? Its connection pool was exhausted (50+ pool_exhausted events/min).
3. Why? A new retry loop in order-service held connections open for up to 120s per attempt.
4. Why? The retry loop had no per-attempt timeout.
5. Why? Our code review checklist does not require timeout verification on new outbound calls to internal services.

## Action items
| Item | Owner | Due | Ticket | Priority |
|---|---|---|---|---|
| Add per-attempt timeout to the retry helper | @dana | 2026-03-21 | PLAT-501 | P0 |
| Add "outbound call timeout" to code review checklist | @erin | 2026-03-28 | ENG-OPS-88 | P1 |
| Add pool_exhausted alert at 20/min (earlier) | @bob | 2026-03-21 | SRE-204 | P1 |
| Post-deploy soak of 15 min for order-service | @dana | 2026-04-04 | PLAT-502 | P2 |
```

### Example 2: SEV3 data correctness issue, no PagerDuty

Input: user pastes a Slack transcript and says "this was a data correctness issue, no paging involved; please write it up anyway."

Output: same structure, but the "Detection" section notes that no alert existed (detection was a customer report via support), and the action items include "add a detection mechanism" as P0.

## Constraints

- **Blameless language only.** No sentence may name a person as the cause. People are responders, not causes. Conditions, processes, and systems are causes.
- **All timestamps in UTC**, ISO-8601 format.
- **Impact must be quantified** where possible. "Some users affected" is not acceptable; give a percent, a count, or an explicit "unknown, see action item to add measurement."
- **Every action item has owner + due + ticket + priority.** No exceptions. If you cannot assign, flag it explicitly.
- **5 whys must bottom out in a system/process, not a person.** If why-5 is "Alice forgot," keep asking.
- **Do not publish without human review.** The skill returns a draft. A human must run the postmortem review before distribution.
- **Related incidents must be real.** If you cite a prior incident, verify the ID exists.

## Quality checks

Before returning, verify:

- [ ] Incident ID, severity, duration, and impact are in the header.
- [ ] Timeline is in UTC, ISO-8601 format, chronological.
- [ ] No sentence names a person in a causal role.
- [ ] Root cause reaches a systemic factor by why-5.
- [ ] "What went well" is not empty.
- [ ] Every action item has owner, due date, ticket, priority.
- [ ] Impact is quantified or explicitly marked "unknown + action item."
- [ ] Detection section includes time-to-detect and time-to-declare.
- [ ] Any cited related incidents have verifiable IDs.

See `references/incident-template.md` for the full template.
