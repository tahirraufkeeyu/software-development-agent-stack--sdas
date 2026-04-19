# E2E Test Patterns

A catalog of reusable patterns for Playwright (and Cypress where noted). Each pattern states **when to use**, **how**, and shows a runnable snippet.

---

## 1. Page Object Model (POM)

One class per page. Public methods correspond to user intent, not UI mechanics.

```ts
export class CartPage {
  constructor(private page: import('@playwright/test').Page) {}
  readonly lineItems = this.page.getByTestId('cart-line-item');
  async removeFirst() {
    await this.lineItems.first().getByTestId('cart-remove').click();
  }
}
```

## 2. App Actions (bypass the UI for setup)

Use the API or app state to set up preconditions instead of clicking through the UI.

```ts
test.beforeEach(async ({ request }) => {
  await request.post('/api/test/seed-cart', { data: { items: ['blue-hoodie'] } });
});
```

## 3. Network stubbing for edge cases

Drive empty states, errors, and rate-limit flows deterministically.

```ts
await page.route('**/api/search**', route =>
  route.fulfill({ status: 200, body: JSON.stringify({ results: [] }) }),
);
```

## 4. Visual regression (Playwright `toHaveScreenshot`)

```ts
await expect(page.getByTestId('dashboard')).toHaveScreenshot('dashboard.png', {
  maxDiffPixelRatio: 0.01,
  animations: 'disabled',
});
```

## 5. Flaky-test quarantine

Tag unstable tests, exclude from the blocking run, still record results.

```ts
test('intermittent webhook flow', { tag: '@flaky' }, async ({ page }) => { /* ... */ });
// playwright.config.ts — run stable by default
export default defineConfig({ grepInvert: /@flaky/ });
```

## 6. Authentication bypass via stored state

Log in once, reuse cookies/localStorage across tests.

```ts
// global-setup.ts
import { request } from '@playwright/test';
export default async () => {
  const ctx = await request.newContext();
  await ctx.post('/api/session', { data: { email: 'qa@example.com', password: process.env.QA_PW } });
  await ctx.storageState({ path: 'tests/.auth/shopper.json' });
};
```

## 7. Test parallelization (Playwright workers)

```ts
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
});
```

## 8. Sharding in CI

```yaml
# .github/workflows/e2e.yml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

## 9. Retries (only in CI)

```ts
export default defineConfig({ retries: process.env.CI ? 2 : 0 });
```

## 10. Fixtures for seeded data

```ts
import { test as base } from '@playwright/test';
type Fixtures = { cart: { id: string } };
export const test = base.extend<Fixtures>({
  cart: async ({ request }, use) => {
    const r = await request.post('/api/test/cart', { data: { items: ['blue-hoodie'] } });
    const cart = await r.json();
    await use(cart);
    await request.delete(`/api/test/cart/${cart.id}`);
  },
});
```

## 11. Accessibility assertions inline

```ts
import AxeBuilder from '@axe-core/playwright';
const a = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
expect(a.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
```

## 12. Role-based locators (fallback when no testid)

```ts
await page.getByRole('button', { name: /sign in/i }).click();
await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
```

## 13. `waitForResponse` for async flows

```ts
const [resp] = await Promise.all([
  page.waitForResponse(r => r.url().includes('/api/checkout') && r.status() === 200),
  page.getByTestId('checkout-pay').click(),
]);
expect(await resp.json()).toHaveProperty('orderId');
```

## 14. `expect.poll` for eventual consistency

```ts
await expect.poll(async () => (await page.request.get('/api/orders/123')).status(), {
  timeout: 10_000,
  intervals: [500, 1_000, 2_000],
}).toBe(200);
```

## 15. Trace + screenshot on failure

```ts
export default defineConfig({
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure' },
});
```

## 16. Multi-tab / multi-context flows

```ts
const context = await browser.newContext();
const buyer = await context.newPage();
const seller = await context.newPage();
await Promise.all([buyer.goto('/buy'), seller.goto('/sell')]);
```

## 17. Mobile emulation

```ts
import { devices } from '@playwright/test';
export default defineConfig({
  projects: [{ name: 'iPhone 15', use: { ...devices['iPhone 15'] } }],
});
```

## 18. Clock control for time-based UI

```ts
await page.clock.install({ time: new Date('2026-04-19T12:00:00Z') });
await page.clock.fastForward('01:00:00');
```

## 19. Soft assertions (collect multiple failures)

```ts
await expect.soft(header).toBeVisible();
await expect.soft(footer).toBeVisible();
await expect.soft(nav).toBeVisible();
```

## 20. API + UI hybrid (API setup, UI assertion)

```ts
test('seeded order appears in history', async ({ page, request }) => {
  await request.post('/api/test/orders', { data: { userId: 'u1', total: 1999 } });
  await page.goto('/account/orders');
  await expect(page.getByTestId('order-row').first()).toContainText('$19.99');
});
```

## 21. Data-driven / parametrized tests

```ts
for (const { input, expected } of [
  { input: 'user@x.com', expected: '/dashboard' },
  { input: 'admin@x.com', expected: '/admin' },
]) {
  test(`routes ${input} to ${expected}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(input);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(expected);
  });
}
```

## 22. Download verification

```ts
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByTestId('export-csv').click(),
]);
expect(download.suggestedFilename()).toMatch(/\.csv$/);
const path = await download.path();
expect(path).toBeTruthy();
```

## 23. Upload verification

```ts
await page.getByTestId('avatar-upload').setInputFiles('fixtures/avatar.png');
await expect(page.getByTestId('avatar-preview')).toBeVisible();
```

## 24. Console and page-error guards

```ts
test.beforeEach(({ page }) => {
  page.on('pageerror', err => { throw err; });
  page.on('console', msg => { if (msg.type() === 'error') throw new Error(msg.text()); });
});
```

## 25. Fixtures with dependency injection (Cypress)

```ts
// cypress/support/commands.ts
Cypress.Commands.add('seedCart', (items: string[]) =>
  cy.request('POST', '/api/test/cart', { items }).its('body.id'),
);
// usage
cy.seedCart(['blue-hoodie']).then(id => cy.visit(`/cart/${id}`));
```
