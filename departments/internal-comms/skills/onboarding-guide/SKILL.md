---
name: onboarding-guide
description: Use when a new hire or transfer is joining a team and needs a structured onboarding document. Generates a Day 1 / Week 1 / Month 1 guide from repository README, CODEOWNERS, CI config, wiki pages, and team directory — including access checklist, reading list, first-PR target, glossary, and runbook index.
---

## When to use

Trigger this skill when:

- A new engineer, designer, PM, or analyst is joining a team.
- An internal transfer is moving to a team and needs a ramp plan.
- A team is reviewing its onboarding materials for staleness (quarterly refresh).
- Contractor or partner-team members need a time-bounded ramp.

Do **not** use this skill for:

- Company-wide onboarding (HR, benefits, org policies) — those belong in a central HR doc.
- Role-specific onboarding plans that require manager judgment (career ladder conversations, perf expectations).

## Inputs

Required:

- **Team name** and **project/repo path** (local or GitHub URL).
- **New hire's role** (e.g., "backend engineer," "product designer").

Optional:

- **New hire's start date** (to anchor Week 1 and Month 1 dates).
- **Manager name** (for 1:1 setup pointers).
- **Access systems** the team uses beyond defaults (e.g., dedicated AWS account, Datadog org, staging VPN).
- **Path to existing onboarding doc** — the skill will refresh it rather than start from scratch.

## Outputs

A Markdown document with the following sections:

1. **Welcome** — one-paragraph intro to the team's mission.
2. **Day 1 — access checklist** — everything needed to log in and say hi.
3. **Week 1 — ramp reading list + first PR target**.
4. **Month 1 — owned areas + first on-call shadow**.
5. **Glossary** — team-specific terms, acronyms, project codenames.
6. **Who to ask for what** — a table.
7. **Runbooks index** — links to the team's operational runbooks.
8. **Feedback** — how the new hire should report gaps in this doc.

## Tool dependencies

- **Read / Grep / Glob** — scan `README.md`, `CONTRIBUTING.md`, `CODEOWNERS`, `.github/workflows/`, `docs/`.
- **Bash** — `git log --format='%aN' | sort -u` to list contributors; `git shortlog -sn` for top contributors to suggest mentors.
- **GitHub MCP** — list repo topics, contributors, and recent good-first-issues.
- **Notion MCP** (optional) — read team wiki pages (runbooks, glossary).
- **Slack MCP** (optional) — identify the team's working channels.

## Procedure

1. **Gather repo metadata.** Read `README.md` for the mission and setup steps. Parse `CODEOWNERS` for area owners. Scan `.github/workflows/` for CI tools in use. List `docs/` subdirectories and `runbooks/` if present.
2. **Identify working systems.** Infer from the repo:
   - Language/runtime (from `package.json`, `pyproject.toml`, `go.mod`, etc.).
   - CI/CD (GitHub Actions, Buildkite, CircleCI from config files).
   - Observability (Datadog, Sentry, Grafana from config or README mentions).
   - Cloud (AWS/GCP/Azure from IaC files).
   - On-call (PagerDuty from README or runbooks).
3. **Build Day 1 access checklist.** Always include: GitHub repo access, Slack channels, 1:1 scheduled with manager, team calendar invite, laptop-build-from-README verified. Add role-specific: cloud console access, staging VPN, observability dashboards.
4. **Build Week 1 reading list.** 3–5 docs max. Prioritize: team charter/mission doc, architecture overview, the most-edited 2–3 files in the repo (from `git shortlog`), current quarter's OKRs if discoverable.
5. **Pick a first-PR target.** Search for issues labeled `good-first-issue`, `help-wanted`, or `docs`. Choose one that touches the repo setup the new hire just ran and does not require context the hire cannot build in week 1. If none available, suggest a doc fix or a test addition.
6. **Build Month 1 owned areas.** From `CODEOWNERS`, identify 1–2 areas the new hire will likely own. Suggest a first on-call shadow week and the mentor's handle.
7. **Extract glossary.** Scan README, wiki, and recent PR titles for team-specific terms and acronyms. Each entry: term, definition, link to canonical source.
8. **Build "who to ask for what" table.** Use CODEOWNERS plus team directory. Columns: Area, Primary contact, Backup, Slack channel.
9. **Index runbooks.** List every file under `runbooks/` or equivalent, with one-line descriptions from each file's first heading.
10. **Anchor dates.** If start date is given, convert "Week 1" and "Month 1" to real dates.
11. **Add feedback section.** Always include a note asking the new hire to flag anything that was unclear, missing, or wrong, and where to send the feedback.
12. **Return** the draft. Recommend the hiring manager customizes the first-PR and mentor picks before sending.

## Examples

### Example 1: Backend engineer joining a Python/FastAPI team

Input: "Generate onboarding for Liam, backend engineer joining the Platform team on 2026-04-28. Repo is `/repos/platform-api`. Manager is Bob."

Output (excerpt):

```
# Welcome to Platform — onboarding guide for Liam

Start date: 2026-04-28. Manager: Bob.

The Platform team owns the internal API surface and the authentication, billing, and notifications services that every other product team depends on. Our mission is "make platform concerns invisible to product teams." If it shows up in an incident postmortem for a team that is not us, we probably own the root cause.

## Day 1 (2026-04-28) — access checklist
- [ ] GitHub: confirm access to `org/platform-api`, `org/platform-infra`, `org/platform-runbooks`. Bob will add you to the @platform team.
- [ ] Slack: join `#platform`, `#platform-oncall`, `#platform-standup`, `#incident-coordination`.
- [ ] AWS: confirm console access to `platform-prod` and `platform-staging` via Okta SSO.
- [ ] Datadog: confirm you land in the Platform org; bookmark the "Platform SLOs" dashboard.
- [ ] PagerDuty: you are NOT on rotation yet; confirm you can view the Platform schedule.
- [ ] 1:1 with Bob: scheduled for 2026-04-28 11:00 UTC.
- [ ] Laptop: clone `platform-api`, run `make dev`, hit `http://localhost:8000/healthz`, see `{"ok": true}`.
- [ ] Introduce yourself in `#platform` — we read these.

## Week 1 (ending 2026-05-02) — reading + first PR
Reading (in order):
1. `docs/architecture/overview.md` — the top-level picture.
2. `docs/architecture/auth.md` — auth is the deepest concept on this team.
3. The current quarter's OKRs (Notion: "Platform 2026-Q2 OKRs").
4. Your pick of one recent postmortem from `#incident-coordination` pins.

First PR target:
- Issue PLAT-448 (`docs: expand the local dev troubleshooting section`). This is a documentation PR that will touch the same README you used on Day 1. Low risk, high "learn the review cycle" value.

1:1 schedule: daily 15-minute checkin with Bob this week; dropping to 2x/week from week 2.

## Month 1 (ending 2026-05-28) — owned areas
By end of month, you should own or co-own:
- The notifications service (`platform-api/services/notifications/`). Dana will be your mentor; pair with her on the first two notifications-related tickets.
- The internal rate-limit dashboard (PLAT-431) — shipped but needs a v2 owner.

On-call:
- Shadow week: 2026-05-19 through 2026-05-25 (with Alice as primary).
- You are added to the rotation starting 2026-06-09.

## Glossary
- **Platform SLO** — service level objective; 99.9% availability per service measured on a 30-day rolling window.
- **Hotpath** — the auth + rate-limit + routing code that every request traverses; changes here require two reviewers.
- **Fast-track deploy** — CI/CD flag for hotfix reverts that skips the standard 15-minute staging soak. See `runbooks/deploy.md`.
- **PLAT** — Linear project prefix for this team.
- **SEC review** — blocking review by AppSec for changes touching auth, data, or customer-facing storage.

## Who to ask for what
| Area | Primary | Backup | Channel |
|---|---|---|---|
| Auth / tokens | Dana | Erin | #platform |
| Billing integration | Marco (PM) + Alice (eng) | Bob | #platform-billing |
| Deploy and CI | Alice | Sam | #platform-oncall |
| AppSec reviews | Priya (AppSec, not on team) | — | #sec-review |
| Product direction | Marco (PM) | Bob | #platform |

## Runbooks
Located in `platform-runbooks/`. The most-used:
- `deploy.md` — how to ship and how to revert.
- `incident.md` — incident response and postmortem process.
- `oncall.md` — what the pager means and what to do about it.
- `postgres-failover.md` — manual failover procedure.
- `retry-storm.md` — detecting and mitigating retry storms.

## Feedback
This doc is generated from the repo and refreshed quarterly. If anything is wrong, stale, or missing, please:
1. Open a PR against `platform-runbooks/onboarding.md`, or
2. Drop a note in `#platform` tagging @bob.

The first few people through a doc always find the most bugs — your feedback makes this better for the next hire.
```

### Example 2: Designer joining a product team, no access to most systems

Input: "Generate onboarding for a product designer joining the Onboarding Experience team. No code repo involved; they work in Figma and Notion."

Output: same structure, but Day 1 access focuses on Figma workspace, Notion team space, research repository (Dovetail), and the product analytics tool. Week 1 reading is the team's design system doc and recent research reports. First-PR target becomes a first design critique to present at. Runbooks section is replaced with "Design rituals" (critique cadence, sprint review format).

## Constraints

- **Real links only.** If the skill cannot verify a file or page exists, it must flag the link as "confirm this exists" rather than fabricate.
- **Dates must anchor to the start date if provided.** "Week 1" should read as actual dates.
- **First PR must be scoped to what is learnable in week 1.** Do not suggest a hotpath change.
- **Mentor handles must be real.** Use CODEOWNERS or `git shortlog` — do not invent names.
- **Keep the glossary tight.** 5–10 terms. A 40-term glossary is not a glossary, it is a dictionary nobody reads.
- **Who-to-ask table must have a backup for every area.** Single-owner documentation creates bus-factor problems.
- **The doc must be editable.** Always include the feedback section and name a maintainer.

## Quality checks

Before returning, verify:

- [ ] Day 1 checklist includes access, Slack, 1:1, and a verified-local-build step.
- [ ] Week 1 reading list is 3–5 items and in priority order.
- [ ] First-PR target exists and is scoped for week 1.
- [ ] Month 1 owned areas come from CODEOWNERS or equivalent.
- [ ] Glossary has 5–10 entries with sources.
- [ ] Who-to-ask table has primary AND backup for each row.
- [ ] Runbooks index lists real files with one-line descriptions.
- [ ] Feedback section names a maintainer and a concrete path to update the doc.
- [ ] If start date is given, Week 1 / Month 1 reference actual dates.
