---
name: social-media
description: Use when a marketer needs to atomize a pillar piece (blog post, launch, case study) into platform-native social posts for LinkedIn, X/Twitter, and the newsletter. Produces posts that match each platform's shape, with posting-time guidance and zero hashtag spam.
safety: writes-local
---

## When to use

Trigger this skill when the request includes any of:

- "Turn this blog post into a LinkedIn post and a Twitter thread"
- "Draft social copy for the launch"
- "Write a newsletter snippet for the new case study"
- "We need three posts promoting the whitepaper"

Do not use for paid ad copy (different constraints), customer support replies, or crisis comms.

## Inputs

Required:

- **Source content** — URL, draft, or summary of the pillar piece being atomized.
- **Primary audience** — role and platform context (e.g., "platform leads, mostly on LinkedIn; engineers, mostly on X").
- **Goal** — one of: drive traffic, drive replies/engagement, capture subscribers, announce.

Optional:

- Author voice (if posting from a personal account vs brand account).
- Target CTA URL.
- Any must-include numbers, quotes, or visuals.

## Outputs

Three deliverables (unless the brief limits to specific platforms):

1. **LinkedIn post** — hook in first 2-3 lines, 150-300 words total, one CTA, posting-time note.
2. **X/Twitter thread** — 7-10 tweets, each ≤280 chars, strong lead tweet, payoff tweet, reply CTA.
3. **Newsletter snippet** — subject line (4-7 words), preview text, 80-120 word body, single CTA.

Plus a **posting plan note**: platform-by-platform recommended send time and any cross-posting rules.

## Tool dependencies

- Read access to `references/platform-best-practices.md` (required — load before drafting).
- Optional: web-fetch to pull the source piece if only a URL is given.

## Procedure

1. **Load the platform reference.** Read `references/platform-best-practices.md`. Note length targets, hook rules, and posting times.
2. **Extract the "one thing."** Every atomization comes from a single claim in the source. Identify it before writing a single post. If the source has more than one claim, pick the sharpest one and ignore the rest.
3. **Draft LinkedIn first.** LinkedIn tolerates the most depth and is usually the primary channel for B2B. Hook in the first 3 lines before the "see more" cutoff (roughly 210 chars). End with a question or a concrete next step, not a hashtag stack.
4. **Draft the X/Twitter thread.** Lead tweet must stand alone if nothing else gets read. Structure: hook → 5-8 substance tweets → payoff → optional "follow for more / reply with X" tweet. No "1/" numbering unless the client prefers it.
5. **Draft the newsletter snippet.** Subject line 4-7 words, preview text extends the subject rather than repeating it. Body pays off the subject in sentence one.
6. **Write the posting plan.** Note optimal send time per platform based on the reference. Flag any platform where the piece is a bad fit (e.g., skip X if the post is a long executive reflection).
7. **Run quality checks.** Fix before returning.

## Examples

### Example 1: Atomize a case study

Source: Ramp case study — CI time cut 62% by swapping Jenkins runners for Northstack, no pipeline rewrites, 8-week rollout.

**LinkedIn post:**

```
Ramp cut CI time by 62% in eight weeks.

They didn't rewrite a single pipeline.

Most platform teams assume a CI migration means months of YAML rewrites and a
fight with every service owner. Ramp's DevEx team had a different theory: the
bottleneck wasn't the pipeline, it was the runner.

So they swapped the runner and left the pipelines alone.

Result after eight weeks:
- p95 queue time: 14 min → 5 min
- Monthly CI spend: down 40%
- Pipeline changes required: zero

The full write-up is linked below. Worth a read if you're staring down a
Jenkins migration this year.

https://northstack.dev/ramp-case-study
```

Posting time: Tuesday or Wednesday, 8:30-9:30am ET.

**X/Twitter thread (7 tweets):**

```
1/ Ramp cut their CI time 62% in 8 weeks. They didn't rewrite a single pipeline.

Here's what they actually changed.

2/ The platform team at Ramp inherited a Jenkins setup with 14-minute p95 queue
times at peak. Everyone assumed the fix was a pipeline rewrite.

They didn't do that.

3/ Their theory: the bottleneck wasn't the pipeline. It was the runner.

Pipelines had become the scapegoat for every CI problem. The actual problem was
cold starts, queue contention, and a VM fleet that was too small too often.

4/ So they swapped the runner. Pipelines stayed byte-for-byte identical.

Migration plan:
- Week 1-2: shadow run on 5% of traffic
- Week 3-5: ramp to 50%
- Week 6-8: cut over

5/ Results after cutover:
- p95 queue: 14 min → 5 min
- CI spend: down 40%
- Pipeline rewrites: 0
- Developer complaints: way down

6/ Lesson: when CI feels slow, measure before you migrate. The pipeline you want
to rewrite is usually fine. The runner under it is the problem.

7/ Full case study with the metrics and the rollout plan:
https://northstack.dev/ramp-case-study

Reply with your p95 queue time if you want a second opinion on where your bottleneck is.
```

Posting time: Tuesday 10am-noon ET or Thursday 2-4pm ET.

**Newsletter snippet:**

Subject: `Ramp cut CI time 62%. No rewrites.`
Preview: `The bottleneck wasn't the pipeline. It was the runner underneath it.`

```
Most CI migrations start with a pipeline rewrite. Ramp's didn't — and they still
cut p95 queue time from 14 minutes to 5 in eight weeks.

Their platform team's bet was that the pipelines were fine. The runner was the
problem. They shadow-ran a new runner on 5% of traffic, ramped to 50% by week
five, and cut over by week eight. Pipeline changes required: zero.

The full breakdown, including the rollout plan and the cost numbers, is worth
15 minutes on a Tuesday morning.

Read the case study →
```

### Example 2: Atomize a launch announcement

Source: Northstack Runners v2 launches with a policy sidecar — lets platform teams enforce CPU/memory/network policy per job without changing pipelines.

**LinkedIn post:**

```
Runners v2 is live.

The short version: you can now enforce resource and network policy per CI job,
without editing a single pipeline. The policy lives in a sidecar, not your YAML.

Why it matters:

Most platform teams are stuck between two bad options. Either they let CI jobs
do whatever they want (and watch a runaway test suite eat the cluster), or they
try to rewrite every pipeline to add limits (and watch that rewrite stall for
six months).

The sidecar splits the difference. Pipelines stay clean. Policy lives with the
platform team.

Docs and the migration guide: https://northstack.dev/runners-v2
```

Posting time: Wednesday 9am ET for maximum launch-day reach.

**X/Twitter thread (8 tweets):** (abridged structure)

1. Lead: "Runners v2 is live. You can now enforce policy per CI job without editing pipelines."
2-3. Why this was hard before.
4-5. How the sidecar works (one code-block tweet).
6. Migration story from a design partner.
7. What it does not do (be honest about limits).
8. CTA + docs link.

**Newsletter snippet:**

Subject: `Runners v2: policy without the rewrite`
Preview: `Per-job CPU, memory, and network policy. Pipelines stay untouched.`

Body pays off with two sentences on the mechanism and a docs link.

## Constraints

- **LinkedIn:** 150-300 words, hook in first 3 lines, never more than 3 hashtags (ideally zero on branded accounts), one CTA.
- **X/Twitter:** each tweet ≤280 chars, thread 7-10 tweets with a payoff, no hashtag stacking, no "1/n" unless requested.
- **Newsletter:** subject 4-7 words, preview text extends the subject (does not repeat it), 80-120 word body, one CTA.
- No banned hype words (see content-writer constraints — same list applies).
- No em-dashes in post bodies.
- One CTA per post. Always.
- Do not fabricate numbers. If the source does not have the stat, do not invent it.
- Emojis are allowed inside the post body only if they earn their spot (one per post maximum, never in the hook line, never replacing a bullet).

## Quality checks

Before returning, confirm:

- [ ] LinkedIn hook reads as a complete thought in the first 3 lines (before "see more").
- [ ] Every tweet in the X thread is ≤280 chars and the lead tweet stands alone.
- [ ] Thread has a clear payoff tweet before the CTA.
- [ ] Newsletter subject is 4-7 words.
- [ ] Newsletter preview text extends the subject rather than duplicating it.
- [ ] Each post has exactly one CTA.
- [ ] No more than 3 hashtags on LinkedIn, 0 on X body tweets, 0 in newsletter.
- [ ] No banned hype words.
- [ ] No em-dashes.
- [ ] Posting-time note is included for each platform.
- [ ] All numbers trace back to the source — none invented.
