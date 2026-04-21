# Internal Comms Department

A collection of Claude Code skills for internal communications teams — the people who keep everyone else in sync. These skills exist to reduce the cognitive tax of recurring writing tasks (weekly status, postmortems, changelogs, onboarding) so humans can spend their energy on the judgment calls, not the boilerplate.

## Why this department exists

Internal comms work is high-volume, high-cadence, and high-consequence. A single missed action item from a meeting can slip a launch by a week. A postmortem written in the wrong tone can damage team trust for months. A status update full of jargon wastes the time of everyone it reaches.

These skills are designed to:

- **Enforce consistency** — the same template, tone, and structure every time, so readers can skim.
- **Preserve cadence** — weekly status, quarterly onboarding refreshes, and changelogs go out reliably.
- **Reduce write-load** — pull structured data from Slack, GitHub, Linear, Notion, and calendar tools, then draft the document. A human reviews and ships.
- **Encourage blamelessness and clarity** — incident reports and status updates are opinionated about language (no status-theater, no blame, call out what is actually blocked).

## Skills

| Skill | Description | Complexity |
|---|---|---|
| `status-update` | Weekly team status in shipped / in flight / next / risks / asks format, sourced from PRs, commits, and the project board | Medium |
| `incident-report` | Blameless postmortem with timeline, 5-whys, and action items, sourced from Slack, logs, and PagerDuty | High |
| `meeting-notes` | Extract decisions, action items, and open questions from a transcript | Low |
| `changelog` | User-facing changelog from git history in Keep a Changelog format | Medium |
| `onboarding-guide` | Day 1 / Week 1 / Month 1 onboarding doc generated from repo metadata | Medium |
| `announcement` | Drafts for product launches, milestones, and policy changes in configurable tone | Low |

## Workflow orchestrator

This department ships one **workflow orchestrator** skill that chains the task skills above into an end-to-end flow. Orchestrators have a richer frontmatter (`chains`, `produces`, `consumes`) and are invoked the same way as any other skill.

| Orchestrator | Chains | One-line purpose |
| --- | --- | --- |
| [comms-weekly](skills/comms-weekly/SKILL.md) | meeting-notes, status-update, announcement | Weekly comms bundle: leadership-sync notes, all-hands status update, and a conditional company-wide announcement. |

## Quick install

```bash
skillskit install internal-comms
```

This copies the skill directory into `~/.claude/skills/` so Claude Code picks them up globally. Target a different tool with `skillskit install --host cursor internal-comms` (or `codex`, `gemini`).

Don't have the CLI yet? Install it with `brew install tahirraufkeeyu/tap/skillskit` (macOS/Linux) or `scoop install tahirraufkeeyu/scoop-bucket/skillskit` (Windows). See [skillskit.dev](https://skillskit.dev/#install) for alternative installers.

## Recommended MCP servers

These skills assume (but don't require) the following MCP servers are configured. Each skill degrades gracefully to manual input if the server is not available.

- **Slack MCP** — for `incident-report` (pull `#incident-*` channel timelines) and `announcement` (post drafts to channels).
- **Notion MCP** — for `onboarding-guide` (read team wiki pages) and `meeting-notes` (write notes back to a meetings database).
- **GitHub MCP** — for `status-update` and `changelog` (list merged PRs, read commit messages, resolve author handles).
- **Linear MCP** or **Jira MCP** — for `status-update` (pull board columns and ticket status) and `incident-report` (link action items to tickets).
- **Google Calendar MCP** — for `meeting-notes` (resolve attendees from the calendar invite) and `status-update` (identify the reporting week).

If you only have one MCP server available, GitHub is the highest-leverage; `status-update` and `changelog` both become far more accurate with it.

## Recommended workflow

Two chains cover most internal-comms weeks:

**Weekly cadence:**

```
meeting-notes  -->  status-update  -->  announcement
```

Run `meeting-notes` after each team meeting to capture decisions and action items. At end-of-week, run `status-update` — it will incorporate the shipped items, action items still open, and any decisions that changed direction. If any shipped item is customer-facing, run `announcement` on top to draft the launch note.

**Incident cadence:**

```
incident-report  -->  changelog
```

After the incident is resolved, run `incident-report` to produce the blameless postmortem. If the incident resulted in a user-visible behavior change or fix, run `changelog` against the resolving PRs to make sure the fix lands in the next release notes under `Fixed` or `Security`.

## Style philosophy

- **Plain language beats status-theater.** "The migration is blocked on a security review that has been open for 11 days" beats "Migration progressing, coordinating with security."
- **Specific beats vague.** Numbers, dates, owners, and tickets, not "soon," "we," and "it."
- **Blameless means systemic.** Incidents are caused by conditions, not by people. Action items target the conditions.
- **Skimmability matters.** Readers are busy. Lead with the summary, use lists, keep bullets under two lines.
