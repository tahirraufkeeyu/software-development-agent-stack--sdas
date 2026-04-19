---
name: status-update
description: Use when a team needs a weekly (or ad-hoc) written status update covering shipped work, in-flight work, next steps, risks, and asks. Pulls from git history, PRs, and the project board, then drafts a ~300-word update in plain language with no status-theater.
---

## When to use

Trigger this skill when:

- A team lead says "write up this week's status" or "draft the Friday update."
- It is the end of a sprint or milestone and a written rollup is needed for leadership, cross-functional partners, or an internal newsletter.
- A new stakeholder has been added and needs to be caught up on the last week or two.

Do **not** use this skill for:

- Personal/daily standup updates (use `engineering:standup` instead).
- Incident-specific updates mid-incident (use `engineering:incident-response`).
- Customer-facing release notes (use `changelog`).

## Inputs

Required:

- **Team name** and **reporting window** (e.g., "Platform team, week of 2026-04-13").
- Access to one of: git repo(s), GitHub/GitLab MCP, project board (Linear/Jira/Asana) MCP, or a manually pasted export of tickets and PRs.

Optional:

- Previous week's status update (for continuity — the skill will check whether prior "next week" items actually shipped).
- List of cross-functional partners to address "asks" to.
- Metrics the team tracks weekly (e.g., p95 latency, signup conversion, open SEV2 count).

## Outputs

A single Markdown document with the following sections, ~300 words total:

1. **Week of `<date>` — `<Team>`** header
2. **TL;DR** — one sentence
3. **Shipped** — bullets with user/business impact, not feature names alone
4. **In flight** — bullets with percent complete and ETA
5. **Next week** — bullets, max 5
6. **Risks and blockers** — each with a mitigation or an explicit "needs help"
7. **Asks** — specific requests from named cross-functional partners
8. **Metrics** (optional) — week-over-week deltas

Output is written to stdout by default. If a path is provided (e.g., a Notion page ID or a file path), the skill writes there.

## Tool dependencies

- **Read** / **Grep** / **Glob** — for scanning local git repos and reading prior status docs.
- **Bash** — `git log`, `git shortlog`, `gh pr list --state merged --search "merged:>=..."`.
- **GitHub MCP** (preferred) — `list_pull_requests`, `list_commits` for richer metadata.
- **Linear MCP** / **Jira MCP** / **Asana MCP** — `list_issues` filtered by team and updated-at window.
- **Notion MCP** (optional) — to read the prior week's update and write the new one.

## Procedure

1. **Confirm scope.** Ask or infer the team name, the reporting window (default: last 7 days ending Friday 23:59 local), and the audience. Audience determines tone.
2. **Pull shipped work.** List merged PRs in the window. Filter out `chore:`, `refactor:`, `test:`, `ci:`, `docs(internal):` unless they are load-bearing. For each remaining PR, extract title, author, linked ticket, and the one-sentence impact from the PR body.
3. **Pull in-flight work.** Query the board for tickets in "In Progress" or "In Review" that are assigned to team members. Capture ticket ID, title, assignee, percent complete (from checklist or subtasks if present), and ETA.
4. **Derive next week.** Tickets in "Ready" or "Next" columns, plus any in-flight items expected to ship. Cap at five.
5. **Identify risks.** Anything in-flight with ETA already past, tickets tagged `blocked`, `at-risk`, or open for >14 days without updates. Include the blocker reason, not just that it is blocked.
6. **Identify asks.** Comments on tickets mentioning another team, PRs awaiting review from a different team for >3 days, or explicit `@team/need-help` labels.
7. **Compare against last week.** If a prior status doc is provided, check which "next week" items from that update actually shipped. Silently drop the ones that shipped; flag the ones that did not as slips.
8. **Draft.** Write the update. Enforce the word budget — if you exceed 350 words, cut from "In flight" first, then "Metrics."
9. **Enforce language rules** (see Constraints).
10. **Return** the draft for human review. Do not post it anywhere without explicit confirmation.

## Examples

### Example 1: Small platform team, GitHub + Linear available

Input: "Write this week's status for the Platform team. Reporting window is 2026-04-13 through 2026-04-19. Previous update is at Notion page `platform-status-2026-04-12`."

Output (excerpt):

```
# Week of 2026-04-19 — Platform team

TL;DR: Shipped the new auth token rotation; the Postgres 16 upgrade is blocked on a security review that has been open 11 days.

## Shipped
- Auth token rotation (PLAT-412): cut forged-token risk window from 24h to 15min. Rolled out to 100% of traffic Thursday.
- Redis connection pooling (PLAT-398): p99 API latency dropped from 340ms to 210ms.
- Removed legacy `/v1/users` endpoint: 4 months after deprecation, 0 callers remaining.

## In flight
- Postgres 16 upgrade (PLAT-377): 60% — schema migration done, canary at 5%. ETA slipped from 4/19 to 4/26.
- Internal rate-limit dashboard (PLAT-431): 40% — Grafana scaffolding merged. ETA 4/30.

## Next week
- Unblock and finish the Postgres 16 rollout.
- Ship the rate-limit dashboard to on-call.
- Start scoping the multi-region replication RFC.

## Risks and blockers
- Postgres 16: security review (SEC-204) open 11 days. Needs Priya or someone on AppSec to drive. Mitigation: asked in #sec-review Tuesday, no response yet.

## Asks
- @AppSec: please prioritize SEC-204 this week.
- @Data: confirm the Postgres 16 breaking-change list matches yours by Wed.
```

### Example 2: No MCP servers, manual paste

Input: user pastes a markdown table of Jira tickets and a list of PR titles from `git log --oneline`.

Output: same structure, but "Shipped" and "In flight" are derived from the pasted data. The skill asks exactly once whether any items were missed before drafting.

## Constraints

- **Word budget: 250–350 words.** The point is to be read.
- **No status-theater phrases.** Banned: "making progress," "coordinating with," "continuing to iterate," "as planned." Replace with the specific thing that happened or did not.
- **No blameless-violating language.** Do not name who caused a slip. Name what caused it.
- **Every risk has a mitigation or an ask.** A risk without either is a complaint, not a status update.
- **Every ask names a person or team and a date.** "Can someone review this?" is not an ask.
- **Do not invent data.** If the board says 40%, say 40%. If you do not know percent complete, say "in review" or "in progress" instead of guessing.
- **Metrics are optional.** Include only if real numbers are available and the team tracks them weekly.

## Quality checks

Before returning, verify:

- [ ] Word count is between 250 and 350.
- [ ] Every "Shipped" bullet names user or business impact, not just the feature.
- [ ] Every "In flight" bullet has a percent or an explicit "in review" status.
- [ ] Every "Risk" has a mitigation or an ask.
- [ ] Every "Ask" names a person/team and a date.
- [ ] No banned status-theater phrases appear.
- [ ] If a prior update was supplied, any "next week" items from it are accounted for (shipped, slipped, or dropped with reason).
- [ ] Ticket IDs and PR numbers are real (cross-checked against the source), not invented.

See `references/status-template.md` for the full template with a worked example.
