---
name: accessibility-audit
description: Use when a page or flow needs a WCAG 2.1 AA conformance audit. Runs axe-core against the live DOM via Chrome DevTools MCP, inspects the accessibility tree, verifies keyboard navigation and focus order, checks color contrast, ARIA roles, landmarks, headings, form labels, skip links, and alt text — and reports every violation with a code-level fix suggestion.
safety: safe
---

## When to use

Invoke this skill when:
- A route is approaching release and needs a WCAG 2.1 AA gate.
- A legal/compliance review requires an accessibility report.
- A design-system component needs a manual a11y check in context.
- A user report cites keyboard, screen-reader, or contrast issues.

Do NOT use when: the check can be automated inline in an e2e test (use `e2e-test-generator` and embed axe); the request is a full manual audit by a certified auditor (this skill assists, does not replace).

## Inputs

- `url` (required): Full URL of the page to audit.
- `viewport` (optional): `{ width, height }`. Default `{ 1366, 768 }` desktop and `{ 375, 667 }` mobile; audit both when unspecified.
- `auth_cookie` (optional): Session cookie for gated routes.
- `axe_tags` (optional): Axe tag list. Default `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]`.
- `include_selectors` / `exclude_selectors` (optional): CSS selectors to scope the scan.

## Outputs

- A Markdown report with:
  - Summary (critical / serious / moderate / minor counts).
  - Violations table with: rule id, WCAG SC, impact, element selector, failure summary, suggested fix.
  - Keyboard-navigation map (tab order + any focus-trap issues).
  - Contrast failures with measured ratio and required ratio.
  - Heading outline + landmark map.
  - Copy-paste-ready fix snippets per violation.

## Tool dependencies

- `mcp__chrome-devtools__new_page`, `mcp__chrome-devtools__navigate_page`, `mcp__chrome-devtools__emulate`.
- `mcp__chrome-devtools__evaluate_script` (to inject axe-core).
- `mcp__chrome-devtools__take_snapshot` (accessibility-tree snapshot).
- `mcp__chrome-devtools__press_key` (Tab walk for focus order).
- `mcp__chrome-devtools__take_screenshot` (attach to contrast violations).
- `Write` for the report.

## Procedure

1. **Open page with cookie.** Navigate, set `auth_cookie` if provided.
2. **Inject axe-core.** Via `evaluate_script`, load axe from a CDN (`https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js`) and run `axe.run({ runOnly: { type: 'tag', values: <axe_tags> } })`.
3. **Collect accessibility tree.** `take_snapshot` to capture the a11y tree; confirm landmarks (`banner`, `navigation`, `main`, `complementary`, `contentinfo`) are present.
4. **Heading outline.** `evaluate_script` to collect `h1..h6` in DOM order; verify exactly one `h1`, no skipped levels.
5. **Form labels.** For each `input`, `textarea`, `select` — verify `id` matches a `<label for>` or has `aria-label`/`aria-labelledby`.
6. **Alt text.** For each `<img>` — require `alt` (empty for decorative, descriptive otherwise). Flag `alt="image"` / `alt="picture"` / filename-as-alt.
7. **Skip link.** The first focusable element on load should link to `#main` (or the main landmark). If absent, flag.
8. **Keyboard walk.** Send Tab 20 times via `press_key`; record each focused element via `evaluate_script(document.activeElement)`. Verify:
   - Focus is always visible (outline not removed without replacement).
   - No keyboard trap (Shift+Tab reverses cleanly).
   - Tab order matches visual order.
9. **Contrast.** Axe reports contrast; cross-check any visual components using `getComputedStyle` + WCAG formula. Required: 4.5:1 for body text, 3:1 for large text (>=18pt or >=14pt bold), 3:1 for UI component and graphical object boundaries.
10. **ARIA roles.** Flag invalid combinations (`role="button"` on an actual `<button>`, `aria-hidden="true"` on a focusable element, redundant roles on native semantics).
11. **Write report.** One Markdown file under `reports/a11y/<yyyy-mm-dd>-<host>-<path>.md`.

## Examples

### Example 1 — Sign-up form audit (desktop)

Input:
```json
{ "url": "https://staging.example.com/signup" }
```

Report (excerpt):

```
# Accessibility audit — /signup (desktop 1366x768)
WCAG 2.1 AA, axe-core 4.10.0, 2026-04-19

## Summary
Critical: 1 | Serious: 3 | Moderate: 2 | Minor: 1

## Violations

### [critical] label — Form element has no accessible name  (WCAG 1.3.1, 4.1.2)
Selector: `form[data-testid=signup] > input[name=password]`
Failure: no <label for="password">, no aria-label, no aria-labelledby.
Fix:
```html
<label for="signup-password">Password</label>
<input id="signup-password" name="password" type="password" autocomplete="new-password">
```

### [serious] color-contrast — 3.1:1 on placeholder text  (WCAG 1.4.3)
Selector: `input[name=email]::placeholder`
Measured: #9a9a9a on #ffffff = 2.85:1. Required: 4.5:1.
Fix: change placeholder color to `#595959` (ratio 7.0:1) or remove placeholder and rely on label only.

### [serious] heading-order — heading levels skip from h1 to h3 (WCAG 1.3.1)
Selector: `h3.signup-legal`
Fix: change to `<h2>` or wrap content under a proper h2 section.

### [moderate] link-name — link has no discernible text (WCAG 2.4.4, 4.1.2)
Selector: `footer a.icon-twitter`
Fix: add `aria-label="Twitter"` or a visually-hidden span.

## Keyboard walk
Tab 1: skip link (visible on focus)  OK
Tab 2: signup-email                    OK
Tab 3: signup-password                 OK — but focus outline removed (see next)
Tab 4: signup-submit                   FAIL: outline: none; no replacement focus style.

## Headings
h1: "Create your account"
h3: "Terms and privacy"  (missing h2)

## Landmarks
banner, main, contentinfo  OK
navigation  missing (consider adding a skip link target)
```

### Example 2 — Dashboard widget audit (mobile)

Input:
```json
{
  "url": "https://app.example.com/dashboard",
  "viewport": { "width": 375, "height": 667 },
  "auth_cookie": "session=abc; Domain=.example.com; Path=/",
  "include_selectors": ["[data-testid=kpi-widget]"]
}
```

Checks unique to mobile:
- Touch-target size >= 24x24 CSS px (WCAG 2.5.8).
- Reflow up to 320 CSS px without horizontal scroll (WCAG 1.4.10).
- Pinch-zoom not disabled (`<meta name=viewport>` must not contain `user-scalable=no` or `maximum-scale=1`).

Expected output includes touch-target violations for icon-only buttons smaller than 24x24.

## Constraints

- Never "fix" accessibility by hiding content from the a11y tree (`aria-hidden="true"`, `display:none`) unless the content is genuinely decorative.
- Every violation in the report must cite a WCAG success criterion (e.g. `WCAG 1.4.3`), not just an axe rule id.
- Do not mark a page as "passing" — axe finds roughly 30–40% of issues; always recommend a manual screen-reader pass for critical flows.
- Color-contrast findings must include the measured ratio and the required ratio, not just a pass/fail.
- When recommending ARIA, prefer native HTML semantics first ("no ARIA is better than bad ARIA").

## Quality checks

- [ ] axe-core was actually injected and ran (verify version string in report).
- [ ] Accessibility tree snapshot captured and referenced.
- [ ] Heading outline shows exactly one `h1` and no skipped levels (or flags the skip).
- [ ] Landmarks `banner`/`main`/`contentinfo` presence checked.
- [ ] Keyboard walk covers >=10 focus stops.
- [ ] Every contrast finding reports measured and required ratio.
- [ ] Every violation in the report has a WCAG SC reference and a code-level fix.
- [ ] Report notes axe's limitations and recommends a manual screen-reader pass.
