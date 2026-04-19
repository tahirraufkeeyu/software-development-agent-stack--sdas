# Research Framework

A structured approach to account research. Use this as the mental model behind the `lead-research` skill's one-page brief.

## The 4 Quadrants

Every account brief is organized around four dimensions. Missing a quadrant leaves a blind spot.

### 1. Company

What the company is, independent of what it is doing.

- Legal name, domain, HQ, additional offices.
- Ownership: private / public / PE-backed / subsidiary.
- Headcount band: 1-50, 51-200, 201-1000, 1001-5000, 5001+.
- Revenue band: <$10M, $10-50M, $50-250M, $250M-$1B, $1B+.
- Verticals served. If they sell to retail, their buying motion will look like retail's.
- Core business model: B2B SaaS, marketplace, D2C, services.

### 2. Industry

What forces act on the company from outside.

- Regulatory pressure: HIPAA, PCI-DSS, SOC 2, GDPR, DORA, state privacy laws, sector rules like FDA 21 CFR Part 11.
- Macro: input costs, FX exposure, interest-rate sensitivity for capex buyers.
- Competitive: who is winning the category, who just raised, who is consolidating.
- Category maturity: greenfield / early majority / mature / declining. This determines buying posture.

### 3. People

Who is in the building, and who just left.

- Target persona: the role being sold to. Pull their LinkedIn for tenure, prior companies, content they post.
- Their boss: often the economic buyer.
- Recent executive changes — an exec within their first 100 days is far more likely to buy.
- Team expansion signals: open roles under the persona indicate budget.
- Culture signals from Glassdoor — not to judge, but to infer stated pain.

### 4. Triggers

What has changed recently that creates a reason to act.

Triggers are the difference between a list of accounts and a queue of opportunities. No trigger, no urgency.

## Trigger Events

Ordered roughly by strength of buying signal:

1. **Funding** — Series A through D, bridge rounds, PE recap. Fresh capital earmarked for a stated initiative is the strongest signal. Look at the press release for "will be used to..." language.
2. **Leadership change** — new CIO, CRO, VP Data, VP Eng. New execs have 100 days to justify their hire with visible change. They are buying.
3. **M&A** — acquirer needs integration tooling; acquired company often rips and replaces within 18 months.
4. **Layoffs or reorgs** — counterintuitively often a buying trigger, because the survivors are asked to do more with less. Target automation plays here.
5. **New product or market launch** — signals capacity for new vendors; roadmap needs new stack.
6. **Regulatory change** — new compliance deadline forces a purchase window (e.g. EU AI Act, DORA).
7. **Public incident** — outage, breach, lawsuit. Creates a forcing function for remediation tooling.
8. **Earnings commentary** — public companies often name the exact initiative they'll invest in on earnings calls.
9. **Technology migration signals** — job postings saying "migrate off X to Y" are explicit buying signals.
10. **Champion change** — your buyer moved to a new company — follow them.

## Scoring

Two 1-5 scores, each with a one-line justification.

### ICP Fit Score (1-5)

How closely does the account match the defined ideal customer profile?

- **5** — Matches every dimension of the ICP: size, vertical, stack, region, business model.
- **4** — Matches all but one dimension (e.g. right vertical, right stack, slightly below revenue band).
- **3** — Matches core dimensions but missing a key qualifier (e.g. right vertical but wrong region).
- **2** — Partial match only; would be a stretch sale.
- **1** — Not a fit. Document why and disqualify.

### Urgency Score (1-5)

How strong is the reason to act now?

- **5** — Multiple fresh triggers (within 60 days), at least one being funding or leadership change.
- **4** — One strong trigger within 60 days.
- **3** — A trigger exists but is older (60-120 days) or indirect.
- **2** — No explicit trigger, but hiring signals suggest directional movement.
- **1** — No triggers. Account is quiet.

A 5/5 ICP score with 1/5 urgency is a nurture target. A 3/5 ICP with 5/5 urgency is an opportunistic play. A 5/5 + 5/5 goes to the top of the queue.

## Output Format: One-Page Brief

Every `lead-research` output is a one-pager with these sections in this order:

```
# [Company Name] — Account Brief

## Snapshot
[2-4 lines of firmographics]

## Tech Stack
[3-6 bullets, each with source attribution]

## Triggers (last 90 days)
- [YYYY-MM-DD] [event]. Source: [url]
- ...

## Hiring Signals
[1-3 bullets on open roles, expansion patterns]

## Pain Signals
[1-3 bullets from Glassdoor / G2 / news, with attribution]

## Scoring
- ICP fit: X/5 — [one-line why]
- Urgency: X/5 — [one-line why]

## Three Outreach Angles
1. [Angle] — Trigger: [trigger]. Persona: [role]. Hypothesis: [testable sentence].
2. ...
3. ...

## Risks and Unknowns
- [What you could not verify]
```

## Anti-patterns

- **Padding with adjectives.** "Fast-growing, innovative, data-driven company" — delete and replace with numbers.
- **Assumed pain.** If you can't source it, don't claim it.
- **Three angles that are all the same angle reworded.** Each angle should be defensible as the lead angle on its own.
- **Missing dates on triggers.** Undated news is not a trigger.
- **Generic persona references.** "Decision maker" is not a persona. Name the role.
