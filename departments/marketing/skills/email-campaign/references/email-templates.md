# Email sequence templates

These templates are the starting point for every sequence `email-campaign` produces. They are written in Northstack's voice but the structure transfers to any B2B SaaS brand. Each email is ready to paste into an ESP and edit for the specific campaign.

All examples use merge tags in `{{double_braces}}` — swap for your ESP's syntax as needed.

---

## Nurture sequence (5 emails over 18 days)

Use for leads who opted in via content download, event registration, or newsletter subscribe. Goal: move them from interested to sales-qualified.

### Nurture #1: Welcome (Day 0, within 10 minutes of trigger)

**Subject:** Your paved road playbook is inside
**Preview:** Plus three companies who did this before you.

```
Hi {{first_name}},

The paved road whitepaper is attached and also linked below. It's the version
we share with platform teams who are already a few months into the conversation
about replacing their portal.

If you're just scanning, skip to page 14. That is the migration sequence.

One thing to flag: I wrote this. If you want to argue with anything in it,
reply to this email. I read every reply.

Read the whitepaper →

Priya Shah
Platform Advocate, Northstack
```

**CTA:** Read the whitepaper

---

### Nurture #2: Story (Day 3, 10am recipient local)

**Subject:** How Ramp did this in 8 weeks
**Preview:** 62% faster CI. Zero pipeline rewrites.

```
Hi {{first_name}},

Quick follow-up on the paved road playbook.

The most common question I get after someone reads it is: "okay, but how does
this actually roll out without breaking production?"

Ramp is the cleanest example. Their platform team swapped runners on 5% of
traffic in week one, ramped to 50% by week five, and cut over by week eight.

CI time dropped 62%. They rewrote zero pipelines.

The full case study is 900 words. Worth a coffee:

Read the Ramp case study →

Priya
```

**CTA:** Read the Ramp case study

---

### Nurture #3: Value (Day 7, 10am recipient local)

**Subject:** The migration checklist
**Preview:** Every step. In order. Free.

```
Hi {{first_name}},

Here's the one-pager we give to every platform team starting a runner migration.

It covers:
- Pre-flight: what to measure before you touch anything
- Shadow mode: running the new runner on 5% of traffic safely
- Cutover: the 3 checks that prevent rollback
- Post-migration: what to watch for the first two weeks

Nothing gated. Just the checklist.

Get the checklist →

Priya

P.S. If you want me to walk through it on a 20-minute call, reply with "walk me through it" and I'll send a calendar link.
```

**CTA:** Get the checklist

---

### Nurture #4: Social Proof (Day 12, 10am recipient local)

**Subject:** Three more teams who migrated
**Preview:** Ramp, Linear, and one we can't name yet.

```
Hi {{first_name}},

A quick snapshot of teams who ran this migration in the last six months.

- Ramp (fintech, 800 engineers): 62% faster CI, 8 weeks, zero rewrites
- Linear (SaaS, 120 engineers): 40% cost reduction, 4 weeks
- [Confidential Series D SaaS]: cut p95 queue time in half, 6 weeks

Different team sizes, different stacks, same pattern: swap the runner, keep
the pipelines.

If your team is in the same range, the playbook almost certainly maps. The
full case studies (for the ones we can publish) are on our customers page.

See the customer stories →

Priya
```

**CTA:** See the customer stories

---

### Nurture #5: Invitation (Day 18, 10am recipient local)

**Subject:** 20 minutes on your setup?
**Preview:** No demo. Just a second opinion.

```
Hi {{first_name}},

Last one, and then I'll stop.

If you've read the whitepaper and the Ramp case study and you're still not
sure whether this maps to your setup, the fastest way to find out is a
20-minute call.

Not a demo. I'll ask you three questions about your current CI setup and
tell you honestly whether Northstack is a fit. If it isn't, I'll tell you
what to look at instead.

Book 20 minutes →

Priya

P.S. If you'd rather just keep reading, no action required. I'll stop
emailing you after this one.
```

**CTA:** Book 20 minutes

---

## Onboarding sequence (4 emails over 10 days)

Use for new signups. Goal: drive the activation event (first successful pipeline run) and build the habit.

### Onboarding #1: Activate (Day 0, within 5 minutes of signup)

**Subject:** Let's get your first runner live
**Preview:** 4 minutes from clone to green build.

```
Hi {{first_name}},

Welcome to Northstack. Here's the fastest path to your first green build.

1. Install the CLI: `brew install northstack/tap/ns`
2. In any repo: `ns init`
3. Push. Your first pipeline runs on our runner.

Most teams are green in under 5 minutes. If you hit anything weird, reply to
this email. It comes to a real inbox and a real engineer will answer.

Start the quickstart →

The Northstack team
```

**CTA:** Start the quickstart

---

### Onboarding #2: First Value (Day 2, 10am recipient local)

**Subject:** See your first real benchmark
**Preview:** How your pipeline actually performed this week.

```
Hi {{first_name}},

You've run {{pipeline_count}} pipelines on Northstack this week. Here's
what the numbers look like:

- p50 duration: {{p50_duration}}
- p95 queue time: {{p95_queue}}
- Success rate: {{success_rate}}%

These numbers live in your dashboard and update every time a job finishes.
If p95 queue time is above 2 minutes, reply and we'll take a look — that
usually means concurrency is mistuned.

See your dashboard →

The Northstack team
```

**CTA:** See your dashboard

---

### Onboarding #3: Tips (Day 5, 10am recipient local)

**Subject:** 3 settings most teams miss
**Preview:** Caching, concurrency, and policy defaults.

```
Hi {{first_name}},

Three settings that move the needle, in order of impact:

1. **Enable remote caching.** Cuts most pipelines 30-50%. One flag in
   `northstack.yml`.

2. **Tune max concurrency per runner.** Default is conservative. Most teams
   double it within the first week.

3. **Set resource policy defaults.** Prevents a runaway test suite from
   hoarding capacity. Takes 2 minutes.

The docs page below has the exact configs.

Read the tuning guide →

The Northstack team
```

**CTA:** Read the tuning guide

---

### Onboarding #4: Feedback (Day 10, 10am recipient local)

**Subject:** One question, 30 seconds
**Preview:** What would make Northstack a 10 out of 10?

```
Hi {{first_name}},

You've been on Northstack for 10 days. Quick question:

On a scale of 1-10, how likely are you to recommend Northstack to another
platform team?

{{nps_link_1}} ... {{nps_link_10}}

Whatever number you pick, the next screen has one text box: "what would make
it a 10?" I read every answer personally.

The Northstack team

P.S. If your answer is below a 7, I'd really like to know why. Reply to this
email directly and I'll book time to dig in.
```

**CTA:** Rate Northstack (1-10)

---

## Re-engagement sequence (3 emails over 12 days)

Use for accounts that have gone dormant (no logins, no runner minutes) for 45-60+ days. Goal: any click, or a clean unsubscribe.

### Re-engagement #1: Miss You (Day 0)

**Subject:** Been a minute
**Preview:** We noticed you haven't run a pipeline in a while.

```
Hi {{first_name}},

We noticed you haven't run a pipeline on Northstack in a while — {{days_inactive}}
days, if you want the specific number.

No pressure. Inboxes and priorities shift. But a few things have changed
since you last logged in:

- Runners v2 shipped with per-job policy (without pipeline rewrites).
- There's a new free tier that covers most small-team setups.
- We finally have a pricing calculator that doesn't lie.

If any of that is interesting, the dashboard is where it was.

Jump back in →

The Northstack team
```

**CTA:** Jump back in

---

### Re-engagement #2: What Changed (Day 6)

**Subject:** What's new since you left
**Preview:** v2, the free tier, and the calculator.

```
Hi {{first_name}},

Quick recap of what's new, in case the last email got buried.

**Runners v2:** per-job CPU, memory, and network policy without editing a
single pipeline. The policy lives in a sidecar.

**Free tier:** 2,000 runner minutes per month, free. Covers most teams
under 20 engineers.

**Pricing calculator:** paste your last month's CI minutes and get a real
estimate. Takes 15 seconds.

Any of those worth a second look?

See what's new →

The Northstack team
```

**CTA:** See what's new

---

### Re-engagement #3: Goodbye / Last Chance (Day 12)

**Subject:** Should we stop emailing you?
**Preview:** If we don't hear back, we'll assume Northstack isn't a fit.

```
We've emailed a few times and haven't heard back. That is fine — inbox is loud.

But we'd rather stop emailing than keep guessing.

If Northstack is still interesting, even a little, click below and we'll keep
you on the list. If not, we'll take the silence as a "no thanks" and stop the
emails next week.

Keep me on the list →

No hard feelings either way.

The Northstack team
```

**CTA:** Keep me on the list

(If no click within 7 days, move to suppression list.)

---

## Usage notes

- Every template above is a starting point. The skill adapts tone, specificity, and CTAs to the actual campaign brief.
- Swap `{{first_name}}` and other merge tags for the ESP's syntax (HubSpot uses `{{contact.firstname}}`, Customer.io uses `{{customer.first_name}}`, etc.).
- Every email needs a compliant footer (physical address, unsubscribe) — ESP templates usually handle this, but the skill flags it anyway.
- Timing (Day 0, Day 3, etc.) is guidance. Adjust based on the segment's historical engagement patterns if the data is available.
- Success metrics per email: nurture = CTR to the anchor content; onboarding = activation event; re-engagement = any click; promotional = conversion.
