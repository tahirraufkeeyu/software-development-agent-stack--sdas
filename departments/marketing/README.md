# Marketing Department Skills

Marketing lives or dies on cadence and quality. The work is inherently multi-channel (blog, social, email, SEO, comms) and compounding — this week's content shapes next quarter's pipeline. Agent skills turn that grind into a repeatable system: a writer who already knows your voice guide, an SEO reviewer who remembers every title-tag rule, an analyst who reads GA4 the same way every Monday morning.

These skills are opinionated. They enforce brand voice, platform-native formatting, CAN-SPAM and GDPR baselines, and the boring-but-load-bearing checks (meta description length, alt text, single CTA per email) that separate professional marketing from content sludge. The goal is not to replace judgment — it is to make the 80% of every deliverable that should be mechanical actually mechanical, so human time goes into angle, insight, and story.

## Skills

| Skill | Description | Complexity |
|-------|-------------|------------|
| content-writer | Blog posts, case studies, and whitepapers from a brief, with brand voice enforcement and structured output (hook, thesis, body, CTA, meta). | Medium |
| social-media | LinkedIn, X/Twitter, and newsletter snippets with platform-native formatting, posting-time guidance, and anti-hashtag-spam rules. | Low |
| seo-optimizer | Keyword research, intent classification, on-page optimization (title, meta, headings, schema, alt text), and Core Web Vitals reminders. | Medium |
| email-campaign | Nurture, onboarding, re-engagement, and promotional sequences with subject-line testing, mobile-first templates, and compliance checks. | Medium |
| competitor-monitor | Weekly digest of competitor content, positioning, pricing, and product moves, with recommended response for each signal. | Medium |
| analytics-report | Weekly marketing analytics rollup across GA4, Mixpanel, and HubSpot with change-hypothesis-action framing and noise filtering. | High |

## Quick install

```
./install.sh marketing
```

This copies every skill into your `.claude/skills/` directory and registers references. Run from the starter-kit root.

## Recommended MCP servers

- **WebSearch / web-fetch** — required by `competitor-monitor` and `seo-optimizer` for SERP checks, competitor crawls, and live page audits.
- **Notion MCP** — drafts land in the marketing workspace: briefs, outlines, and final content live next to the calendar.
- **Google Analytics MCP** (where available) — lets `analytics-report` pull GA4 metrics directly rather than via exports.
- **HubSpot MCP** — required by `email-campaign` for list counts, sequence enrollment, and by `analytics-report` for pipeline attribution.
- **Slack MCP** — posting the weekly analytics digest and competitor-monitor summary into `#marketing` closes the loop.

If a server is missing the skill still works, but it will ask you to paste the raw data instead of pulling it itself.

## Recommended workflow

Run this as a weekly cycle, ideally Monday morning through Friday afternoon:

```
competitor-monitor  →  content-writer  →  seo-optimizer  →  social-media  →  email-campaign  →  analytics-report
        Mon               Mon-Tue            Tue              Wed              Thu                  Fri
```

1. **Monday: competitor-monitor** surfaces what shifted in the market over the weekend. Feed any interesting signal straight into the content brief.
2. **Monday-Tuesday: content-writer** produces the week's pillar piece from the brief. Voice, structure, and CTA are already enforced.
3. **Tuesday: seo-optimizer** reviews the draft before publish — keywords, headings, meta, internal links, schema.
4. **Wednesday: social-media** atomizes the pillar into LinkedIn long-form, a Twitter/X thread, and a newsletter snippet.
5. **Thursday: email-campaign** queues the nurture or promotional send that rides on the new content.
6. **Friday: analytics-report** closes the week with sessions, CVR, email engagement, and pipeline contribution — and a hypothesis for next Monday's brief.

The cycle compounds: last week's analytics informs this week's competitor framing, which informs the brief, which informs everything else.
