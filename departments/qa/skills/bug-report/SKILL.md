---
name: bug-report
description: Use when a defect needs to be filed in a structured, reproducible format. Produces a bug report with an observed-behavior title, environment, numbered steps to reproduce, expected vs. actual, frequency, severity, priority, attachments, related tickets, and workaround. Enforces reproducibility before filing.
safety: writes-local
---

## When to use

Invoke this skill when:
- A QA engineer, developer, or user observes a defect.
- Another skill (performance, accessibility, e2e) detects a regression.
- A support escalation needs to be converted into an engineering-ready ticket.

Do NOT use when: the issue is a feature request (use a different intake); the root cause is already known and a fix is in flight (write a PR instead).

## Inputs

- `observation` (required): One-sentence description of what went wrong ("Cart badge count stays at 0 after adding first item").
- `environment` (required):
  - `os`, `browser` or `app_version`, `build` (git SHA or release tag), `device`, `network` (wifi/4g/throttled).
- `steps` (required): Ordered list of user actions, each a single verb phrase.
- `expected` (required): What the user expected.
- `actual` (required): What the user observed.
- `frequency` (required): `always` | `intermittent (N/M)` | `once`.
- `severity` (required): `blocker` | `critical` | `major` | `minor` | `trivial`.
- `priority` (required): `P0` | `P1` | `P2` | `P3`.
- `attachments` (optional): Paths to screenshots, videos, HAR files, console logs.
- `related_tickets` (optional): Issue IDs for related / duplicate / blocked-by tickets.
- `workaround` (optional): If the user found one.

## Outputs

- A Markdown file following `references/bug-report-template.md`, saved to `reports/bugs/<yyyy-mm-dd>-<slug>.md`.
- A reproduction verdict: `reproducible` | `intermittent` | `not_reproducible`. Non-reproducible reports are NOT filed; the skill instead returns a checklist of information to collect.
- If the caller has a tracker MCP configured (Jira, Linear, GitHub Issues), a follow-up suggestion to create the ticket with the generated body.

## Tool dependencies

- `Read`, `Write`, `Edit`.
- `references/bug-report-template.md` for the template.
- Optional: tracker MCP (Linear, Jira, GitHub) for filing; this skill only drafts, never files automatically.

## Procedure

1. **Collect.** Validate all required inputs. If any required field is missing, return a targeted question set — do not fabricate.
2. **Attempt reproduction.** If a runnable target is provided (URL + steps), execute the steps (via Playwright MCP or Chrome DevTools MCP) and record the result. If not reproducible after 3 attempts, set verdict `not_reproducible` and list what additional info is needed (network HAR, console log, exact time, user id, feature flags).
3. **Deduplicate.** Grep the bug archive (`reports/bugs/`) and the tracker (if MCP available) for similar titles / stack traces. Surface duplicates.
4. **Assess severity/priority.** Use this rubric:
   - **Blocker:** data loss, security exposure, or a core flow fully broken.
   - **Critical:** core flow broken with no workaround.
   - **Major:** core flow degraded or secondary flow broken.
   - **Minor:** cosmetic, non-blocking.
   - **Trivial:** typo, spacing.
   Priority combines severity with reach (users affected) and revenue impact.
5. **Fill the template.** Copy `references/bug-report-template.md` and populate.
6. **Attach evidence.** Link screenshots/HAR/logs; verify paths exist.
7. **Suggest workaround.** If one exists or can be derived from the steps, include it.
8. **Return.** The Markdown file path and a one-line summary.

## Examples

### Example 1 — Reproducible cart bug

Input:
```json
{
  "observation": "Cart badge count stays at 0 after adding first item",
  "environment": {"os": "macOS 15.3", "browser": "Chrome 133", "build": "shop@2026.04.19-rc3", "device": "MacBook Pro 14 M3", "network": "wifi"},
  "steps": ["Open /products/blue-hoodie", "Click 'Add to cart'", "Observe header cart badge"],
  "expected": "Badge shows '1'",
  "actual": "Badge shows '0'; cart drawer shows the item correctly on open",
  "frequency": "always",
  "severity": "major",
  "priority": "P1",
  "attachments": ["screenshots/cart-badge-zero.png", "logs/console.log"]
}
```

Generated file `reports/bugs/2026-04-19-cart-badge-stays-at-zero.md` (excerpt):

```
# Cart badge count stays at 0 after adding first item

## Summary
Adding the first item to an empty cart leaves the header badge at 0. The cart drawer lists the item correctly, confirming the POST /api/cart succeeded; only the badge UI fails to update.

## Environment
- OS: macOS 15.3
- Browser: Chrome 133 (stable)
- Build: shop@2026.04.19-rc3 (commit a1b2c3d)
- Device: MacBook Pro 14 M3
- Network: wifi

## Severity: major
## Priority: P1
## Frequency: always (5/5)

## Steps to reproduce
1. Sign out, then open https://staging.shop.example.com/products/blue-hoodie in a clean incognito window.
2. Click the "Add to cart" button (data-testid="product-add-to-cart").
3. Observe the cart badge in the header (data-testid="header-cart-count").

## Expected
Header cart badge displays "1".

## Actual
Header cart badge stays at "0". Opening the cart drawer shows the item, so the POST succeeded; only the badge fails to update. Refreshing the page then shows "1".

## Impact
Users cannot tell an add-to-cart succeeded from the header alone. Likely to cause duplicate adds and cart-abandonment escalations.

## Attachments
- screenshots/cart-badge-zero.png
- logs/console.log  (shows "Warning: state mutation outside store" from cartStore.ts:84)

## Related tickets
- SHOP-1822 (previous badge regression, closed 2026-02-11)

## Workaround
Refresh the page after adding to cart.
```

### Example 2 — Not reproducible

Input: "Checkout page sometimes shows 500" with no steps, no build, no logs.

Skill output:
```
Verdict: not_reproducible

Please provide:
- Exact URL (path + query)
- Build (release tag or git SHA)
- Approximate timestamp (within 5 minutes, timezone)
- User id or session id (so we can find server logs)
- Browser console output and a HAR file
- Feature flags enabled for the session (from /_/flags)
- Steps that preceded the error (including prior page)

Not filing until at least URL + build + timestamp are available.
```

## Constraints

- Never file a bug that cannot be reproduced; return the info-gathering checklist instead.
- Titles must describe **observed behavior**, not hypothesis ("Badge stays at 0" not "State mutation in cart store").
- Steps must be numbered, start with a verb, and each do exactly one thing.
- Never include PII in the report body; scrub emails/names in attachments first.
- Severity and priority are always both present; they measure different things (impact vs. urgency).
- Attachments must be referenced by path; if the path does not resolve, flag it.

## Quality checks

- [ ] Title describes observed behavior, under 80 chars.
- [ ] Environment includes OS, browser/app version, build (SHA or tag), device, network.
- [ ] Steps are numbered and atomic.
- [ ] Expected and Actual are both present and differ materially.
- [ ] Frequency is quantified (e.g. `5/5`, `2/10`, not just "sometimes").
- [ ] Severity + Priority both set.
- [ ] Attachments exist on disk (or are clearly marked "pending").
- [ ] Related tickets grep-checked for duplicates.
- [ ] Workaround present or explicitly marked "none found".
