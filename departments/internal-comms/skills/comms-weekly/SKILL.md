---
name: comms-weekly
description: Use when running the internal-comms team's weekly rhythm covering the leadership sync, an all-hands status update, and a conditional company-wide announcement. Bundles the week's artifacts into a single package markdown with distribution list and publish timestamps.
safety: writes-local
produces: comms/weekly/<week-of>-package.md
consumes:
  - comms/weekly/<week-of>/leadership-notes.md
  - comms/weekly/<week-of>/status-update.md
  - comms/weekly/<week-of>/announcement.md
chains:
  - meeting-notes
  - status-update
  - announcement
---

## When to use

Trigger this orchestrator when:

- The weekly leadership sync has concluded and a transcript is available.
- Someone says "run the comms week", "prep the weekly comms package", or "roll up this week's internal comms".
- It is Monday or Tuesday of a given workweek and the comms team needs the three-part bundle produced.

Do not use for:

- Ad-hoc incident comms (use incident-response comms patterns).
- Exec-to-exec memos that do not get distributed (use a direct draft, not this pipeline).
- Customer-facing comms (this is internal only; external announcements go through marketing or PR review).

## Chained skills

In execution order:

1. `meeting-notes` — processes the leadership-sync transcript. Extracts decisions, action items, open questions. Writes `leadership-notes.md`.
2. `status-update` — drafts the all-hands status update from the extracted decisions plus per-team bullets. Writes `status-update.md`.
3. `announcement` — invoked only when a milestone, policy change, launch, org change, or customer-impacting decision is detected in step 1. Writes `announcement.md`.

The orchestrator inspects decisions from step 1 against an announcement-trigger rubric (below) to decide whether to run step 3.

## Inputs

Required:

- **Week-of slug** — ISO Monday date, e.g. `2026-04-13`.
- **Leadership-sync transcript** — file path, paste, or link (Otter, Granola, Fireflies, Meet).
- **Team inputs** — per-team bullets (shipped, in-flight, blocked) from team leads. Expected teams default to: Platform, Product, Design, Growth, Revenue, People, Finance. Override via `teams` input.

Optional:

- **Distribution list** — default `all@company`. Override for restricted-scope weeks.
- **Announcement audience** — one of `all-employees`, `customers`, `both`. Defaults to `all-employees`.
- **Publish timestamps** — if not provided, uses Tuesday 16:00 local for status, announcement (if any) Thursday 09:00 local.

## Outputs

A single Markdown bundle at `comms/weekly/<week-of>-package.md`, containing:

1. **Header** — `Week of <week-of>`, owner (comms DRI), distribution list, publish timestamps for each artifact.
2. **Table of contents** — links to each of the three artifacts (or notes the announcement was skipped).
3. **Leadership notes summary** — top-5 decisions and top-5 action items, lifted verbatim from `leadership-notes.md`.
4. **Status update preview** — first 120 words of `status-update.md`.
5. **Announcement preview** — first 80 words of `announcement.md`, or a single line `No company-wide announcement this week` with the reason.
6. **Distribution plan** — channel, audience, and timestamp per artifact.

Side effects: creates `comms/weekly/<week-of>/` and its two-or-three artifact files.

## Tool dependencies

- Filesystem write access under `comms/weekly/`.
- Each chained skill's dependencies (transcript parsing for `meeting-notes`, team-input intake for `status-update`, brand voice guide for `announcement`).
- Optional: Slack MCP to schedule the status-update and announcement drops.
- Optional: Notion MCP to mirror the package into the comms workspace.

## Procedure

1. **Resolve `<week-of>`.** Default to the ISO Monday of the current week. Create `comms/weekly/<week-of>/` if absent.
2. **Run meeting-notes.** Pass the transcript. Write `leadership-notes.md`. Require the output to include a `Decisions` section and an `Action items` table; if either is missing, stop.
3. **Classify decisions against the announcement-trigger rubric.** Flag a decision as announcement-worthy when any of the following apply:
   - It is a launch, GA, or deprecation of a customer-facing product or feature.
   - It changes pricing, packaging, or SLAs.
   - It changes org structure, reporting lines, or headcount plans at team-lead level or above.
   - It changes a company-wide policy (time off, remote, security, compensation).
   - It materially changes roadmap scope (add or remove an entire workstream).
4. **Run status-update.** Feed it the decisions list plus the per-team bullets. Write `status-update.md` with sections per team and a top "Decisions this week" block.
5. **Conditionally run announcement.** If any decision was flagged in step 3, invoke `announcement` with the flagged decision(s) and the announcement audience. Produce both an internal-facing and, if audience is `customers` or `both`, a customer-facing variant plus a short FAQ. Write `announcement.md`. If no decisions were flagged, skip and record the reason.
6. **Assemble the package.** Write `<week-of>-package.md` per Outputs. Include a Distribution plan table and publish timestamps.
7. **Close out.** Print the package path and the publish schedule. Do not publish automatically; the comms DRI reviews and schedules.

## Examples

### Example 1 — no announcement week (week-of 2026-04-13)

Leadership sync runs Monday 09:00-10:00 local. Attendees: Maya Chen (CEO), Diego Alvarez (CPO), Priya Ramaswamy (CTO), Sam Okafor (CRO), Lena Brandt (CFO).

Transcript excerpt fed to `meeting-notes`:

> Maya: "Let's lock the Q2 OKRs as drafted, minor edits only."
> Diego: "I want to cut the mobile redesign scope — keep the settings revamp, drop the nav experiment this quarter."
> Priya: "Agreed. We'll reallocate two engineers to the billing migration."
> Sam: "No pricing changes this quarter, full stop."
> Lena: "Hiring plan holds; we revisit in June."

`leadership-notes.md` extracts four decisions: (1) Q2 OKRs locked, (2) mobile redesign scope reduced to settings revamp, (3) two engineers reallocated to billing migration, (4) no pricing changes this quarter. None trip the announcement rubric — scope reductions internal to Product do not hit customer-facing or policy thresholds.

`status-update.md` rolls up five teams: Platform (shipped canary deploy v3, in-flight billing migration, blocked on vendor invoice); Product (mobile scope cut, settings revamp on track); Design (research for settings revamp starts Wed); Growth (A/B test on pricing page live); Revenue (two new logos signed).

No announcement. Package markdown notes: "No company-wide announcement this week. Reason: decisions were scope and resource reallocations internal to Product and Platform, none hit the announcement rubric."

Distribution plan: `status-update.md` drops Tuesday 16:00 local to `#all-hands`. Leadership notes restricted to `#leadership` channel.

### Example 2 — launch announcement week (week-of 2026-04-20)

Leadership sync confirms a new pricing tier, "Scale", launching Thursday 2026-04-23 at 09:00 local.

Transcript excerpt:

> Sam: "Scale tier is a go for Thursday. $2,400/month, includes SSO, audit log export, and the 99.95% SLA."
> Maya: "Confirmed. Grandfather existing enterprise customers for 60 days on their current terms."
> Diego: "In-app banner lights up at 09:00. Docs are staged. Status page note goes out same time."
> Priya: "Engineering sign-off on the SLA math is done."

`meeting-notes` flags the Scale-tier decision as a `launch milestone` and as a `pricing / packaging change` — two triggers from the rubric.

`status-update.md` includes a "Scale tier preview" section above the per-team rollups, with the Thursday timing, the grandfathering window, and a pointer to the FAQ.

`announcement.md` has three blocks:

1. Internal variant — 220 words, addresses the "why now", the grandfathering window, who to route customer questions to (Sam's team), and the internal talking points doc link.
2. Customer-facing variant — 160 words, leads with the three new capabilities (SSO, audit log export, 99.95% SLA), states the price, links to the pricing page and the migration doc.
3. FAQ — six questions covering grandfathering, downgrade path, SSO provider support, invoice timing, SLA credit mechanics, and support contact.

Distribution timeline: internal variant drops Wednesday 16:00 local to `#all-hands` (24-hour heads-up); customer variant publishes Thursday 09:00 local via in-app banner, status page note, and customer newsletter; FAQ is attached to both.

Package markdown header lists all three artifacts with their publish timestamps and the comms DRI (Jordan Park).

## Constraints

- Do not publish artifacts automatically. Drafts only.
- Never include raw transcript quotes longer than three sentences in `leadership-notes.md` — summarize.
- Restricted-scope decisions (compensation specifics, individual performance, M&A) must not leak into the all-hands `status-update.md`. If flagged in the transcript, keep them inside `leadership-notes.md` under a `Confidential — leadership only` subsection and exclude from the package preview.
- If the announcement-trigger rubric is ambiguous, escalate to the comms DRI before drafting; do not guess.
- All timestamps in the package are local time with the timezone abbreviation; never bare numbers.
- No emojis in any artifact or in the package markdown.

## Quality checks

Before returning success:

- [ ] `comms/weekly/<week-of>/` contains `leadership-notes.md` and `status-update.md`, plus `announcement.md` if triggered.
- [ ] Every action item in `leadership-notes.md` has an owner and a deadline.
- [ ] `status-update.md` has one section per expected team or an explicit `no update` note.
- [ ] If announcement was skipped, the package states the reason referencing the rubric.
- [ ] If announcement ran, both internal and customer variants exist when audience is `customers` or `both`, and the FAQ has at least five questions.
- [ ] Distribution plan table in the package names channel, audience, and timestamp for each artifact.
- [ ] No transcript verbatim block exceeds three sentences.
- [ ] No confidential-leadership content appears in the package preview or the status update.
