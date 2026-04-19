# Northstack brand voice guide

Northstack builds developer tools for platform teams — CI runners, paved-road templates, and a policy engine for internal infrastructure. Our audience is staff-plus engineers and platform leads at 200-2000 person companies. They have seen every vendor pitch, they do not forgive hype, and they reward precision.

This guide is the reference every piece of marketing content should pass through before it ships.

## Who we are talking to

- Platform engineering leads, staff platform engineers, heads of developer experience.
- They have run Jenkins. They have evaluated Backstage. They have been burned by vendors who could not explain their own pricing.
- They read the docs before they read the landing page.
- They trust numbers, screenshots, and architecture diagrams. They distrust adjectives.

## Tone pillars

### 1. Confident, not arrogant

We know our space. We state our view directly. We do not hedge every sentence with "we believe" or "in our opinion." We also do not pretend we invented ideas we did not invent.

- Do: "Paved roads beat portals for self-service. Here is why."
- Do not: "Some might argue that paved roads could potentially be a better fit in certain scenarios."
- Do not: "Northstack revolutionized platform engineering."

### 2. Technical but accessible

Our reader is technical. We use the right word, not a simpler one. But we do not assume they have read our docs. We define terms the first time they appear if the term is ambiguous.

- Do: "A paved road is an opinionated default path — a template, a runner, and a policy bundle — that makes the right thing the easy thing."
- Do not: "A paved road leverages synergistic defaults to optimize developer throughput."
- Do not: "A paved road is like a sidewalk for code." (too cute)

### 3. Concise

Cut the sentence in half, then cut it again. If a paragraph does not earn its three lines, it gets one.

- Do: "Ramp cut CI time 62%. The pipelines did not change. The runner did."
- Do not: "At the end of the day, Ramp was able to successfully achieve a substantial 62% reduction in their overall CI time by making a strategic decision to change their runner."

### 4. No hype

We never call anything revolutionary, seamless, cutting-edge, game-changing, next-gen, or a game-changer. We let the numbers and the screenshots do the selling.

## Vocabulary

### We use

platform team, platform engineering, paved road, internal developer portal, runner, pipeline, self-service, developer experience, throughput, queue time, p95, latency, opinionated default, migration, rollback, observability, policy-as-code, SLO, toil, on-call.

### We avoid

revolutionary, game-changing, seamless, cutting-edge, next-gen, unlock, leverage (as a verb), synergy, ecosystem play, best-in-class, world-class, empower, holistic, robust, innovative, disruptive, at scale (when it means nothing), journey (when it means project).

### We qualify, never hedge

"In our benchmarks, p95 dropped 40%." Fine.
"We think, in our opinion, that performance might have possibly improved somewhat." Not fine.

## Style rules

- **Sentence case headlines.** "The paved road beats the portal." Not "The Paved Road Beats The Portal."
- **Oxford comma.** Always. "Runners, pipelines, and policy."
- **No em-dashes in marketing copy.** Replace with a period, a comma, or parentheses. (This rule is specific to outbound marketing. Docs and engineering blog posts may use em-dashes.)
- **Numerals for 10 and above, words for one through nine,** except in headlines and stats callouts where numerals are always fine.
- **Percentages as numerals plus `%` sign.** "62%," not "62 percent."
- **First-person plural ("we") for the company.** Never "Northstack leverages...".
- **Second person ("you") for the reader.** Never "the user" or "the customer" in body copy.
- **One idea per paragraph.** If you need "also" or "additionally," start a new paragraph.
- **Contractions are fine.** "We're" beats "we are" in most copy.

## Do / don't pairs

| Do | Don't |
|----|-------|
| "Ramp cut CI time 62%." | "Ramp unlocked massive CI performance gains." |
| "Here is what broke." | "Let's dive into what happened." |
| "You do not need a portal. You need a paved road." | "In today's fast-paced world, teams are looking for better solutions." |
| "We were wrong about Backstage." | "We have learned some interesting lessons on our platform journey." |
| "Queue time dropped from 14 minutes to 5." | "We saw significant improvements in developer throughput." |
| "The runner costs $0.004 per minute." | "Our pricing is designed to scale with your success." |
| "Read the migration doc." | "Learn more about how we can help you succeed!" |

## Example paragraph that passes the voice test

> Every platform team we talk to installed a developer portal in 2023. A year later, most of them are quietly deprecating it. The portal was never the product. The paved road was. When developers self-serve, they are not browsing a catalog. They are running `northstack init` and getting a working pipeline on the first try.

Why it passes:

- Concrete subject ("every platform team we talk to").
- A number and a timeline.
- A direct claim, no hedging.
- No banned words.
- A specific mechanism (`northstack init`), not a buzzword.
- Sentences vary in length. Last sentence lands the point.

## Example paragraph that fails the voice test

> In today's rapidly evolving cloud-native landscape, platform teams are on a journey to unlock developer productivity at scale. Northstack's innovative, best-in-class paved-road solutions empower engineering leaders to seamlessly leverage opinionated defaults and drive holistic transformation across their ecosystem.

Why it fails:

- "Rapidly evolving," "journey," "unlock," "at scale," "innovative," "best-in-class," "empower," "seamlessly," "leverage," "holistic," "ecosystem" — eleven banned words in two sentences.
- No subject doing anything. No number. No example.
- Could be about any vendor in any category.

## The spot-check

Before shipping, read any three body paragraphs aloud. If you hear any of the following, rewrite:

1. A sentence you would not say to a staff engineer over coffee.
2. A word from the "we avoid" list.
3. A claim without a number, an example, or a source.
4. A paragraph that could have been written by any other vendor in our category.

If those three paragraphs pass, the piece is in voice.
