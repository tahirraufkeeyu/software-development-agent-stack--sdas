# Sales Department Skills

Agent-assisted sales skills that compress the two most expensive parts of the sales motion: research and writing. A rep typically spends 30-60 minutes per target account on pre-call research, another 45-90 minutes drafting a first-touch sequence, and multiple hours assembling a proposal or RFP response. These skills pull that down to minutes while preserving the personalization that differentiates human selling from spam.

These skills are designed to be chained. The output of `lead-research` is the input to `email-outreach`. The meeting booked by that sequence becomes the input to `meeting-prep`. The discovery captured in the meeting feeds `proposal-writer`. Each skill assumes the outputs of its upstream neighbor — structured briefs, not prose blobs.

## Skills

| Skill | Description | Complexity |
|---|---|---|
| `lead-research` | One-page account brief: firmographics, tech stack, trigger events, 3 outreach angles | Medium |
| `competitive-analysis` | Competitor battlecard with positioning, pricing, objection handling, landmines | Medium |
| `proposal-writer` | Tailored proposal tied to discovery notes, with scope, pricing, case studies | High |
| `email-outreach` | 3-step cold and 4-step warm sequences grounded in the research brief | Low |
| `rfp-responder` | RFP requirement tree, gap analysis, section-by-section compliant response | High |
| `meeting-prep` | Pre-meeting brief with attendee research, agenda, talking points, objections | Medium |

## Quick Install

```bash
./install.sh sales
```

This copies the `sales/skills/*` directory into your local `~/.claude/skills/` and registers each `SKILL.md` with the Claude Code harness. Run `claude skills list` to confirm.

## Recommended MCP Servers

These skills lean heavily on external data. Install whichever of the following are available in your environment:

- **Web fetch / WebSearch** — mandatory for `lead-research`, `competitive-analysis`, and `meeting-prep`. Without a live fetch capability, these skills fall back to the user supplying copy-pasted source material.
- **Salesforce MCP** or **HubSpot MCP** — pulls account, contact, and opportunity records so skills can ground research in prior history instead of starting cold. Also allows `email-outreach` to log drafts as activities.
- **Notion MCP** — read-only access to your sales knowledge base: case studies, pricing sheets, security pages, previous RFP responses. `proposal-writer` and `rfp-responder` rely on this for proof material.
- **Slack MCP** — post the output of `lead-research` and `meeting-prep` into the deal channel so the wider account team sees the brief without a manual paste.
- **Gmail MCP** or **Outlook MCP** (optional) — lets `email-outreach` save drafts directly into the rep's outbox.
- **Google Calendar MCP** (optional) — `meeting-prep` reads the invite to extract attendees, so the rep does not have to enumerate them.

## Recommended Workflow

The typical outbound deal path runs each skill once, in sequence:

```
lead-research  →  email-outreach  →  meeting-prep  →  proposal-writer
   (Day 0)         (Day 0-1)          (Day 7-14)       (Day 21-45)
```

- **Day 0** — `lead-research` produces the one-page brief. Sales ops or the rep triggers it against a named account from an ICP list.
- **Day 0 to 1** — `email-outreach` consumes the brief and drafts a 3-step cold sequence. Rep edits and schedules.
- **Day 7 to 14** — Meeting is booked. `meeting-prep` is run the day before, with the calendar invite as input.
- **Day 21 to 45** — After discovery and a demo, `proposal-writer` consumes the discovery notes and generates a tailored proposal.

For inbound RFPs, replace the middle with `rfp-responder`:

```
lead-research  →  rfp-responder  →  meeting-prep (for clarification call)
```

`competitive-analysis` is run out-of-band — typically once per quarter per named competitor, then referenced by the other skills when the research surfaces a rival incumbent.
