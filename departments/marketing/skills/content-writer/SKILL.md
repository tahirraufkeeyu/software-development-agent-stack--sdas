---
name: content-writer
description: Use when a marketer gives you a content brief (topic, audience, goal, length) and needs a publish-ready blog post, case study, or whitepaper. Produces a structured draft with hook, thesis, scannable body, CTA, and meta description in the brand voice defined in references/brand-voice-guide.md.
safety: writes-local
---

## When to use

Trigger this skill when the request includes any of:

- "Write a blog post on X"
- "Draft a case study about customer Y"
- "We need a whitepaper on Z for the ABM campaign"
- "Turn this outline into a 1,500-word post"
- A brief with fields like topic, audience, goal, and desired length

Do not use for short social copy (use `social-media`), email sequences (use `email-campaign`), or landing pages without a narrative structure.

## Inputs

Required:

- **Topic** — the specific claim, story, or question the piece answers.
- **Audience** — role and seniority (e.g., "platform engineering leads at 200-1000 person SaaS companies").
- **Goal** — one of: educate, rank for keyword, capture lead, support sales conversation, launch announcement.
- **Length** — target word count (short: 600-900, medium: 1,000-1,800, long: 2,000-3,500).

Optional:

- Target keyword and related queries (if missing, flag for `seo-optimizer`).
- Supporting data, quotes, or internal docs the writer should cite.
- Format: blog post, case study, whitepaper section, or executive op-ed.
- CTA destination (demo, docs page, report download, webinar).

## Outputs

A single Markdown document containing:

1. **Title** — sentence case, ≤60 characters where possible.
2. **Meta description** — 140-155 characters, includes the primary keyword and a clear value statement.
3. **Hook** — first 2-3 sentences that set tension and earn the scroll.
4. **Thesis** — one line stating the argument or takeaway.
5. **Body** — H2/H3 hierarchy, paragraphs ≤3 lines, at least one concrete example, one data point or source, and one visual suggestion (diagram/screenshot/pull-quote).
6. **CTA** — one sentence + link. Never more than one primary CTA.
7. **Author note** — 2-3 bullet points on what was cut, what assumptions were made, and which claims need a source check.

## Tool dependencies

- Read access to `references/brand-voice-guide.md` (required — load before drafting).
- Optional: WebSearch / web-fetch for fact-checking and pulling external stats.
- Optional: Notion MCP to drop the finished draft into the content calendar.

## Procedure

1. **Parse the brief.** Extract topic, audience, goal, length. If any of the four are missing, ask once before drafting. Do not guess the audience.
2. **Load the brand voice guide.** Read `references/brand-voice-guide.md` in full. Note the do/don't vocabulary list and the style rules.
3. **Pick the structure by format:**
   - Blog post: hook → thesis → 3-5 body sections → CTA.
   - Case study: situation → problem → approach → result (with ≥1 number) → quote → CTA.
   - Whitepaper section: executive summary → claim → evidence → counter-argument → implication.
4. **Draft the hook.** Lead with a specific tension, number, or observation — never with "In today's fast-paced world" or similar. Hook must make the thesis feel necessary.
5. **Write the body.** Use H2 for major sections, H3 for sub-points. Keep paragraphs to 3 lines max on desktop. Every section needs an example, a data point, or both.
6. **Write the CTA.** One action, written as the reader's next logical step, not as a sales line. "Read the docs for the v2 migration" beats "Learn more today!"
7. **Write the meta description last.** 140-155 chars, primary keyword near the front, includes the payoff.
8. **Run the quality checks below.** Fix before returning.

## Examples

### Example 1: Blog post brief

Input:

```
Topic: Why platform teams are replacing internal developer portals with paved roads
Audience: Platform engineering leads at 200-1000 person SaaS companies
Goal: Educate + rank for "internal developer portal alternatives"
Length: 1,400 words
Primary keyword: internal developer portal alternatives
```

Output (abridged):

```markdown
# The paved road is beating the portal. Here is why.

**Meta description:** Internal developer portals promise self-service. Paved roads deliver it.
Here is what platform teams learned after two years of running both.

Every platform team we talk to installed a developer portal in 2023. A year later, most
of them are quietly deprecating it. The portal was never the product — the paved road was.

## The portal promised self-service. Paved roads delivered it.

[H3: What a paved road actually is]
[H3: Where the portal model broke]

## Three signs your portal is becoming a museum
...

**Next step:** Read our paved-road reference architecture in the docs.
```

Author note:

- Cut a section on IDP vendor comparisons — too close to a sales pitch for an educational piece.
- Assumed the reader has run a portal in production; flag for editorial if the audience is earlier-stage.
- The "80% of platform teams" stat needs a source — placeholder until we pull the CNCF survey.

### Example 2: Case study brief

Input:

```
Topic: Ramp cut CI time 62% after moving from Jenkins to Northstack runners
Audience: Heads of DevEx at fintech and SaaS
Goal: Support sales conversation for Series C-D accounts
Length: 900 words
```

Output (abridged):

```markdown
# Ramp cut CI time by 62% without rewriting a single pipeline

**Meta description:** Ramp's developer experience team replaced Jenkins with Northstack
runners in eight weeks. The result: 62% faster CI and zero pipeline rewrites.

When Ramp's platform team sat down in January, the CI queue was 14 minutes deep at peak...

## Situation
## The problem: queue depth, not compute
## The approach: swap the runner, keep the pipelines
## The result: 62% faster, 40% cheaper
> "We expected to rewrite. We rewrote nothing." — Priya Shah, Staff Platform Engineer

**Next step:** See the migration playbook.
```

Author note:

- Kept one customer quote; more would dilute.
- Numbers are from the case study interview transcript — confirm with Ramp before publishing.

## Constraints

- Sentence case headlines. Not Title Case.
- Oxford comma. Always.
- No em-dashes in marketing copy. Use parentheses, commas, or a new sentence.
- Paragraphs ≤3 lines.
- One primary CTA per piece.
- No hype words: "revolutionary," "game-changing," "seamless," "cutting-edge," "unlock," "leverage," "synergy."
- No passive voice in the hook or CTA.
- Every claim about a customer, number, or competitor needs a source or a flag.
- Word count within ±10% of the brief.

## Quality checks

Before returning the draft, confirm:

- [ ] Hook does not start with a platitude or a dictionary definition.
- [ ] Thesis is one sentence and appears in the first 150 words.
- [ ] Every H2 section has at least one example or data point.
- [ ] Meta description is 140-155 characters and includes the primary keyword.
- [ ] Title is ≤60 characters in sentence case.
- [ ] No banned hype words (see constraints).
- [ ] No em-dashes in body copy.
- [ ] Exactly one primary CTA.
- [ ] Paragraphs are scannable (≤3 lines).
- [ ] Author note lists unverified claims.
- [ ] Voice matches `references/brand-voice-guide.md` — spot-check 3 paragraphs against the do/don't list.
