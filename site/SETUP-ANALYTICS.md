# Analytics setup — PostHog Cloud

This site uses [PostHog Cloud](https://posthog.com) for product
analytics: page views, unique visitors, and a handful of custom
events around the customizer and install-snippet copy buttons. The
free tier (1M events / month) is plenty for early traffic.

## 1. Create the PostHog project

1. Sign up at <https://us.posthog.com>.
2. Create a new project named `skillskit.dev`.
3. **Project settings → General → Project API Key.** Copy the key
   — it starts with `phc_…`. This is a **public** project key,
   safe to ship in the client bundle.

## 2. Wire the env vars

### Local dev (optional)

If you want events from `npm run dev` to land in PostHog (useful for
debugging event shapes), copy `.env.example` to `.env` and paste the
key in:

```bash
cd site
cp .env.example .env
# edit .env — paste your phc_… key into PUBLIC_POSTHOG_KEY
```

Without the key, `src/lib/analytics.ts`'s `track()` calls no-op
cleanly. Page views, the PostHog script, and every event simply do
nothing locally.

### AWS Amplify (production)

1. Amplify console → **App settings → Environment variables**.
2. Add two variables:
   - `PUBLIC_POSTHOG_KEY` = `phc_…` (from step 1)
   - `PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
3. Scope them to the `main` branch so preview deploys don't send
   events into the production project. (Create a separate
   `skillskit.dev-preview` project if you want preview analytics.)
4. Redeploy `main`. The build inlines the key into the client bundle
   because of the `PUBLIC_` prefix.

## 3. What's being tracked

All call-sites use `track(eventName, props)` from
`src/lib/analytics.ts`. The module is a thin wrapper that no-ops if
`posthog` isn't on `window`.

### Page views

Handled automatically by the PostHog snippet
(`capture_pageview: true`). Nothing else needed.

### Custom events

| Event | Where | Properties |
|---|---|---|
| `customize_opened` | Any `[data-open-customizer]` click (per-skill page + landing hero) | `skill`, `department` |
| `customize_submitted` | User hits Generate in the customizer | `skill`, `department`, `model`, `has_tech_stack`, `has_constraints`, `has_extra` |
| `customize_generated_ok` | LLM response successfully arrived and passed validation | `skill`, `department`, `model`, `output_chars`, `validation_ok` |
| `customize_copied_oneliner` | Click "Copy install command" in the done state | `skill`, `department` |
| `customize_downloaded_zip` | Click "Download zip" in the done state | `skill`, `department` |
| `install_snippet_copied` | Copy button on any install snippet (hero, brew, scoop, curl, PowerShell) | `source` — "hero" or the platform card heading |

## 4. Useful PostHog queries

Open **Product analytics → Insights → New insight** in the PostHog
UI and build trends / funnels from these events.

- **Customization funnel**: `customize_opened` → `customize_submitted`
  → `customize_generated_ok` → (`customize_copied_oneliner` OR
  `customize_downloaded_zip`). Drop-off reveals where users bail.
- **Install conversion**: `$pageview` on `/` → `install_snippet_copied`.
  Shows what share of visitors copy an install command.
- **Top skills customized**: breakdown of `customize_opened` by
  `skill` property.
- **Install-method split**: breakdown of `install_snippet_copied` by
  `source` property (tells you whether brew vs scoop vs curl gets
  the most traction).

## 5. What PostHog doesn't cover — package download counts

PostHog only sees what happens **in the browser**. It can't count
`brew install` / `scoop install` / `curl | sh` executions from a
terminal. Those ultimately fetch GitHub Release assets, and
GitHub's per-asset `download_count` is the source of truth:

```bash
curl -s https://api.github.com/repos/tahirraufkeeyu/software-development-agent-stack--sdas/releases \
  | jq '[.[] | {tag: .tag_name, total: ([.assets[].download_count] | add)}]'
```

A `/stats` page pulling this at build time is a reasonable next
step if you want the number surfaced on the site.

## 6. Privacy

PostHog is GDPR-friendly out of the box. The snippet is configured
with `person_profiles: "identified_only"` — we never call
`posthog.identify()`, so no user profile is created for a visitor.
Events are tied to an anonymous distinct-id that PostHog rotates per
browser, no cookies set by us. No consent banner is required for
this setup under GDPR/ePrivacy guidance for strictly analytics use.

If you later add anything that needs consent (retargeting, session
replay with PII, identified users), revisit this. For the current
setup the PostHog defaults suffice.
