# Bug Report Template

Copy this template into `reports/bugs/<yyyy-mm-dd>-<short-slug>.md` and fill every section. A field marked **required** must be present before filing; a field marked **optional** may be omitted but its absence should be deliberate.

---

## Title (required)

State the **observed behavior**, not a hypothesis or proposed fix. Under 80 characters.

Good: `Cart badge count stays at 0 after adding first item`
Bad:  `Fix state mutation in cartStore.ts`

---

## Summary (required)

One short paragraph (2–4 sentences) describing what happens, who is affected, and why it matters. No speculation about root cause.

---

## Environment (required)

- **OS:** (e.g. macOS 15.3, Windows 11 23H2, Android 14, iOS 18.3)
- **Browser / App version:** (e.g. Chrome 133.0.6943.98, Safari 18.3, iOS app 2026.4.0)
- **Build:** release tag **and** git SHA (e.g. `shop@2026.04.19-rc3` / `a1b2c3d`)
- **Device:** (e.g. MacBook Pro 14 M3, Pixel 8, iPhone 15)
- **Network:** (wifi, ethernet, 4g, throttled-3g)
- **Screen/viewport:** (e.g. 1440x900 @ 2x, mobile 375x667)
- **Feature flags:** list any non-default flag state
- **Logged-in user role / tenant:** (e.g. admin in tenant `acme-staging`, or "signed out")

---

## Severity (required)

One of:

- **Blocker:** data loss, security exposure, or a core flow fully broken for all users.
- **Critical:** core flow broken with no workaround.
- **Major:** core flow degraded, secondary flow broken, or a workaround exists but is clumsy.
- **Minor:** cosmetic or non-blocking functional issue.
- **Trivial:** typo, alignment, copy polish.

## Priority (required)

One of `P0` (drop everything), `P1` (next sprint), `P2` (backlog, scheduled), `P3` (nice to have).

Priority is **not** the same as severity. A minor issue on the signup page (high reach) may be P1; a critical issue in an admin tool used by 3 people may be P2.

---

## Frequency (required)

Quantify: `always (5/5)`, `intermittent (3/10)`, or `once`. Avoid "sometimes" without a ratio.

---

## Steps to reproduce (required)

Numbered, atomic, each starting with a verb. Include the starting state (signed in? fresh browser? feature flag on?).

```
1. Sign out and clear cookies for staging.shop.example.com.
2. Open https://staging.shop.example.com/products/blue-hoodie in Chrome 133.
3. Click the "Add to cart" button (data-testid="product-add-to-cart").
4. Observe the cart badge in the header (data-testid="header-cart-count").
```

---

## Expected result (required)

What should happen. One paragraph or a short list.

---

## Actual result (required)

What actually happens. Include exact error text, response codes, or screenshots by reference.

---

## Impact (required)

Who is affected and how badly. Quantify where possible: `~35% of signed-in shoppers per day`, `blocks QA sign-off for release 2026.04.19`.

---

## Attachments (optional but strongly recommended)

- **Screenshots:** `screenshots/<name>.png`
- **Screen recording:** `recordings/<name>.mp4` (short — trim to the defect)
- **HAR file:** `har/<name>.har`
- **Console log:** `logs/<name>.console.log`
- **Server log excerpt:** `logs/<name>.server.log` (correlate by request id if available)
- **Trace:** `trace/<name>.json` (Playwright trace or Chrome performance trace)

Reference each attachment by relative path; confirm it exists on disk.

---

## Related tickets (optional)

- Duplicates: `...`
- Blocks: `...`
- Blocked by: `...`
- Previously regressed: `...`

---

## Workaround (required — may be "none found")

If one exists, state it concisely so support can unblock users. Mark clearly if the workaround has side effects.

---

## Root-cause notes (optional)

If any investigation has been done (stack trace, suspect commit, reproduction in a minimal repro), include it here. Keep the title and summary observation-focused even when notes exist.

---

# Example — filled in

## Title
Cart badge count stays at 0 after adding first item

## Summary
Adding the first item to an empty cart leaves the header badge at 0. The cart drawer lists the item correctly, indicating the POST /api/cart succeeded; only the badge UI fails to update until the page is refreshed. Likely to cause duplicate adds and cart-abandonment escalations.

## Environment
- OS: macOS 15.3
- Browser: Chrome 133.0.6943.98
- Build: shop@2026.04.19-rc3 / a1b2c3d
- Device: MacBook Pro 14 M3
- Network: wifi
- Screen/viewport: 1440x900 @ 2x
- Feature flags: default
- Logged-in user role / tenant: signed out

## Severity: major
## Priority: P1
## Frequency: always (5/5)

## Steps to reproduce
1. Open an incognito window in Chrome 133.
2. Navigate to https://staging.shop.example.com/products/blue-hoodie.
3. Click "Add to cart" (data-testid="product-add-to-cart").
4. Observe the header cart badge (data-testid="header-cart-count").

## Expected result
Header cart badge displays "1".

## Actual result
Header cart badge stays at "0". Opening the cart drawer shows the item present, confirming the POST /api/cart 200 succeeded. A full page refresh then updates the badge to "1".

## Impact
Affects every first add-to-cart on the product detail page for signed-out shoppers. Sampling shows ~35% of new sessions add from PDP; estimated 4.1% of add-to-carts are duplicated as a result based on session replay review from release 2026.04.12.

## Attachments
- screenshots/cart-badge-zero.png
- recordings/cart-badge-zero.mp4
- logs/console.log (shows `Warning: state mutation outside store` from cartStore.ts:84)
- har/pdp-add-to-cart.har

## Related tickets
- SHOP-1822 (previous badge regression, closed 2026-02-11 — possible reintroduction)
- SHOP-2044 (tracks cart-state refactor merged on 2026-04-17 — suspect commit)

## Workaround
Refresh the page after add-to-cart; badge will then reflect the correct count.

## Root-cause notes
`cartStore.ts` in release 2026.04.17 introduced a derived selector for `badgeCount` that reads from `state.items.length` at subscribe time only. The mutation path now replaces the items array identity without triggering the subscriber. Suspect commit: `a1b2c3d`.
