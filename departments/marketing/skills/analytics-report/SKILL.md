---
name: analytics-report
description: Use when the marketing team needs a weekly analytics rollup across GA4, Mixpanel, HubSpot, and social/email platforms. Produces a one-page digest with week-over-week changes, hypotheses for the changes, recommended next actions, and an explicit signal-vs-noise call on each metric.
safety: writes-local
---

## When to use

Trigger this skill when the request includes any of:

- "Run the weekly marketing analytics report"
- "What changed in our numbers last week?"
- "Why did organic traffic drop on Tuesday?"
- "Summarize email and social performance for the Friday standup"
- A scheduled Friday-afternoon job

Do not use for deep attribution analysis (separate multi-touch modeling project), real-time dashboards (live BI tool territory), or ad-hoc queries that would be faster answered directly in the source tool.

## Inputs

Required:

- **Reporting period** — defaults to "last completed week, Monday through Sunday." Accepts custom ranges.
- **Data sources** — which of GA4, Mixpanel, HubSpot, LinkedIn, X, and email platform the report should cover.

Optional:

- **Previous week's report** — enables consistent format and trend continuity.
- **Known events** — launches, outages, holidays, or large campaigns that landed during the period. These are context that changes the interpretation.
- **Focus metrics** — if a specific KPI is in focus this quarter (e.g., "CVR on the pricing page"), flag it.

## Outputs

A one-page Markdown report with the following sections:

1. **Header** — reporting period, data sources, known context (launches, outages, campaigns).
2. **Top-line scoreboard** — 6-10 KPIs with this week's value, previous week's value, absolute delta, and percentage delta.
3. **What changed** — 3-5 bullets calling out the largest movements, each tagged as **signal** or **noise**.
4. **Why we think** — a hypothesis for each signal-tagged change, with confidence level (high/medium/low) and the evidence behind it.
5. **What to do next** — 1-3 specific actions for the coming week, each with an owner and a success criterion.
6. **Noise log** — brief note on the noise-tagged movements and why they are being dismissed. Important for auditability.

## Tool dependencies

- GA4 MCP (or manual export) — sessions, users, engagement rate, conversions.
- Mixpanel MCP (or manual export) — product-level events (signup, activation, feature usage).
- HubSpot MCP (or manual export) — email open/click, list growth, MQL/SQL counts, pipeline contribution.
- LinkedIn and X analytics — impressions, engagement rate, profile visits, follower growth.
- Email platform analytics — open rate, CTR, unsubscribe rate, deliverability.
- Optional: Slack MCP to post the report into `#marketing` on Friday afternoon.

## Procedure

### 1. Define the baseline

1. **Lock the date range.** Default: previous Monday 00:00 through Sunday 23:59 in the primary reporting timezone.
2. **Pull the same range from the prior week** for week-over-week comparison. For monthly views, pull the prior 4 weeks.
3. **Note any known context** — a launch on Tuesday, an outage on Thursday, a public holiday — anything that will bend the data.

### 2. Pull the core metrics

At minimum, pull:

**Traffic (GA4):**
- Sessions
- Users
- Engagement rate
- Top 5 landing pages by sessions
- Top 5 sources (organic, direct, referral, paid, social, email)

**Conversion (GA4 + HubSpot):**
- Primary CVR (demo request, signup, whatever is the north star)
- MQL count
- SQL count
- Pipeline $ attributed to marketing

**SEO (Search Console if available):**
- Total clicks from search
- Average position for the top 10 tracked keywords
- Rank changes >3 positions on tracked keywords

**Product activation (Mixpanel):**
- New signups
- Activation rate (signup → first successful event)
- Week-1 retention

**Email (ESP):**
- Sends
- Open rate
- CTR
- Unsubscribe rate
- Top-performing subject by CTR

**Social (LinkedIn + X):**
- Impressions
- Engagement rate
- Follower growth
- Top-performing post by engagement

### 3. Calculate deltas

For every metric, compute:

- Absolute delta (this week − last week)
- Percentage delta ((this − last) / last × 100)
- 4-week trailing average, for context on whether this week is unusual

### 4. Signal vs noise

For each notable delta, apply this test:

- **Signal** if: the change is >15% AND larger than the typical week-over-week volatility for that metric AND not explained by a known calendar effect (holiday, launch, pause).
- **Noise** if: the change is within normal weekly variance, explainable by a one-off event, or based on a too-small sample to be significant.
- **When in doubt, call it noise.** False signals waste team cycles; real signals persist and will show up again next week.

### 5. Hypothesis for every signal

For each metric flagged as signal, write a hypothesis that includes:

- **What changed** (the metric and direction).
- **Why we think** (the most likely cause, based on evidence).
- **Confidence level** (high/medium/low).
- **Evidence** (what data supports the hypothesis).
- **What would disprove it** (what we would look for next week).

Never state a hypothesis as fact. "We think X caused Y, because Z" beats "X caused Y."

### 6. Recommend actions

For each signal, propose at most one action. Each action has:

- A specific deliverable ("draft a rebuttal post," "A/B test the pricing page hero").
- An owner (role or name).
- A success criterion ("CVR on pricing page improves 10% next week").

No action is a valid recommendation if the signal just needs another week of data.

### 7. Post and archive

- Post the report into `#marketing` on Slack (Friday 4pm local).
- Archive in the weekly analytics folder.
- Link the previous week's report in the header for continuity.

## Examples

### Example 1: Standard weekly report

Output (abridged):

```
# Marketing analytics — week of 2026-04-13 to 2026-04-19

Sources: GA4, Mixpanel, HubSpot, LinkedIn, X, Customer.io.
Known context: Runners v2 launched Wednesday 2026-04-15.
Previous report: [link]

## Scoreboard

| Metric | This week | Last week | Δ | Δ% |
|---|---|---|---|---|
| Sessions | 48,210 | 39,540 | +8,670 | +21.9% |
| Signups | 312 | 268 | +44 | +16.4% |
| Activation rate | 58% | 61% | -3pp | -4.9% |
| Demo requests | 47 | 41 | +6 | +14.6% |
| MQLs | 182 | 165 | +17 | +10.3% |
| SQLs | 41 | 38 | +3 | +7.9% |
| Email open rate | 38.2% | 41.0% | -2.8pp | -6.8% |
| Email CTR | 4.1% | 3.8% | +0.3pp | +7.9% |
| LinkedIn engagement rate | 6.8% | 4.2% | +2.6pp | +61.9% |
| Organic search clicks | 6,420 | 6,380 | +40 | +0.6% |

## What changed

- **Sessions up 22% week over week** — **signal.** Launch traffic from Runners v2 on Wednesday drove most of the gain.
- **LinkedIn engagement rate up 62%** — **signal.** Launch-day post hit 280+ reactions, far above our 4-week average.
- **Activation rate down 3 percentage points** — **signal.** Inverse of signup surge. Worth investigating.
- **Email open rate down 2.8pp** — **noise.** Inside normal weekly variance (4-week stdev is 3.1pp).
- **Organic search clicks flat** — **noise.** Normal Tuesday-holiday week within tracking tolerance.

## Why we think

**Sessions up 22%**
- Hypothesis: Runners v2 launch drove a traffic spike on Wed-Thu that carried through the rest of the week.
- Confidence: **high**.
- Evidence: 68% of the session gain came from /runners/v2 landing page and /blog/runners-v2-launch. Referrer mix shows LinkedIn and Hacker News as top sources.
- Disproof: if next week's sessions return to the 39-40k baseline and no sustained SEO lift shows, the launch was a one-week event.

**LinkedIn engagement up 62%**
- Hypothesis: The founder's launch-day post outperformed because the mechanism (sidecar policy) was concretely novel.
- Confidence: **medium**.
- Evidence: post-level analytics show 82% of engagement came from the single launch post. Comments skew technical (platform engineers).
- Disproof: if next week's non-launch posts revert to 4% engagement, the lift is launch-specific not a sustained audience shift.

**Activation rate down 3pp**
- Hypothesis: Launch brought in a wider top-of-funnel including more window-shoppers who signed up but did not run a pipeline.
- Confidence: **medium**.
- Evidence: new signups from LinkedIn referrer activated at 48%, vs 62% for organic signups. Sample size: 312.
- Disproof: if activation stays depressed two more weeks with no launch effect, the drop is a product/onboarding issue, not a cohort quality issue.

## What to do next

1. **Watch activation by acquisition source for two more weeks.** Owner: growth PM. Success: we know whether the drop is cohort or onboarding by 2026-05-03.
2. **Ship a launch-week retrospective post next Tuesday.** Owner: content. Success: sustains LinkedIn engagement above 5% for the week.
3. **Do not touch email cadence or subject-line strategy this week.** Owner: lifecycle. Success: email open rate returns to baseline naturally.

## Noise log

- Email open rate -2.8pp: within 4-week stdev (3.1pp). Not acting.
- Organic search clicks flat: Tuesday was a US public holiday, depressing weekday search. Expected.
- X impressions down 12%: small sample, normal variance.
```

### Example 2: Flat week (no material change)

Output (abridged):

```
# Marketing analytics — week of 2026-03-30 to 2026-04-05

Sources: GA4, HubSpot, Customer.io.
Known context: No launches, no campaigns. Spring break in most US school districts.
Previous report: [link]

## Scoreboard
[table showing all metrics within ±8% of prior week]

## What changed
- Nothing material. All metrics inside the 4-week weekly variance envelope.

## Why we think
- It was a quiet week. That is fine.

## What to do next
1. No new actions. Continue the planned content calendar.
2. Flag for next week: Runners v2 launch on 2026-04-15 will require careful
   noise/signal calls. Plan to pull the prior 4-week baseline before launch.

## Noise log
- All movements within tolerance. No signals to log.
```

## Constraints

- **One page.** If the report is longer than one page rendered, it will not get read. Cut.
- **Every signal has a hypothesis.** Never surface a change without attempting an explanation — even "we do not know yet" is an answer.
- **Every hypothesis has a confidence level.** High/medium/low. No weasel-worded "it seems that possibly."
- **Every action has an owner.** No floating recommendations.
- **Signal vs noise is explicit.** Every notable movement is labeled one or the other.
- **Do not double-count metrics across sources.** A session is not a user is not a visit. Pick the canonical definition and stick to it in every weekly report.
- **Do not compare non-comparable ranges.** A holiday week vs a normal week needs a caveat, not a silent comparison.
- **No predictions dressed as observations.** "CVR is trending down" is a hypothesis, not a metric.

## Quality checks

Before returning the report, confirm:

- [ ] Reporting period matches the input.
- [ ] Every KPI has this week, last week, absolute delta, and percentage delta.
- [ ] Every notable movement is tagged signal or noise.
- [ ] Every signal has a hypothesis with confidence level and evidence.
- [ ] Every hypothesis includes what would disprove it.
- [ ] Every recommended action has an owner and a success criterion.
- [ ] The noise log exists and is non-empty (if nothing is noise, the signal filter is miscalibrated).
- [ ] Known context (launches, outages, holidays) is stated in the header.
- [ ] Report fits in one page when rendered.
- [ ] Prior week's report is linked for continuity.
