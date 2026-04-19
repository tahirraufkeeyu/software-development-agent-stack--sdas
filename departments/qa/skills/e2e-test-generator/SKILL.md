---
name: e2e-test-generator
description: Use when a user story, acceptance criteria, or Jira ticket needs to be turned into a runnable Playwright or Cypress end-to-end test. Generates page-object-model specs with data-testid selectors, explicit waits, network mocking for edge cases, screenshot-on-failure, and inline accessibility assertions.
---

## When to use

Invoke this skill when:
- A product manager or engineer provides a user story ("As a user, I want to add items to cart and checkout").
- You need a new spec for an existing flow and the repo already uses Playwright or Cypress.
- You want to port an ad-hoc smoke test into the page object model.
- You are adding regression coverage for a recently shipped feature.

Do NOT use when: the target flow is unstable or not yet wired up (write stubs instead); the repo uses a framework other than Playwright/Cypress (propose one first); the story is a pure API flow (use `api-test-generator`).

## Inputs

- `story` (required): User story or acceptance criteria in plain text.
- `framework` (required): `playwright` or `cypress`. Inferred from repo if present.
- `base_url` (required): Origin under test, e.g. `https://staging.example.com`.
- `selectors` (optional): Known `data-testid` values or a path to a selectors map.
- `auth_mode` (optional): `storage-state`, `api-login`, or `ui-login`. Default `storage-state`.
- `paths` (optional): Target directories — `pageObjectsDir` (default `tests/pages/`), `specsDir` (default `tests/e2e/`).

## Outputs

- One or more spec files in `specsDir`.
- One page object per distinct page the story touches in `pageObjectsDir`.
- A fixtures file if the story requires seeded data.
- A short report listing: files written, tests generated, any TODO markers for selectors that could not be resolved.

## Tool dependencies

- `Read`, `Write`, `Edit`, `Grep`, `Glob` (always).
- Playwright MCP (optional) for dry-running generated specs.
- `references/test-patterns.md` for the catalog of 20+ reusable patterns.

## Procedure

1. **Discover the framework.** Grep for `@playwright/test` or `cypress` in `package.json`. If neither is present, ask the user which to scaffold.
2. **Load selectors.** Grep the target pages/components for `data-testid="..."`. If fewer than 3 are found on the critical path, emit a report entry recommending the developer add testids first.
3. **Parse the story.** Extract actors, preconditions, actions (one per sentence), and observable outcomes. Each observable becomes one `expect`.
4. **Draft page objects.** One class per page. Public methods correspond to user actions (`addToCart`, `checkout`). Fields are `Locator`s built from `data-testid`. No CSS classes.
5. **Draft the spec.** Use `test.describe` per story, one `test` per acceptance criterion. Every `test` ends with at least one `expect`.
6. **Add waits.** Use web-first assertions (`expect(locator).toBeVisible()`) and `page.waitForResponse(url)` for async flows. Never `waitForTimeout`.
7. **Mock non-happy paths.** For empty states, 5xx, and rate-limit flows, use `page.route(url, route => route.fulfill({ status, body }))`.
8. **Add screenshot + trace.** Confirm `use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' }` is set in `playwright.config.ts`; add it if missing.
9. **Add inline a11y.** Inject `@axe-core/playwright` on the final page of each flow and assert zero violations with `serious`/`critical` impact.
10. **Write files.** Never overwrite without diffing. Emit a summary.

## Examples

### Example 1 — Add-to-cart and checkout (Playwright)

Story: *As a shopper, I want to add a product to my cart and complete checkout with a saved card so that I receive a confirmation.*

`tests/pages/ProductPage.ts`

```ts
import { Page, Locator, expect } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly addToCart: Locator;
  readonly cartBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addToCart = page.getByTestId('product-add-to-cart');
    this.cartBadge = page.getByTestId('header-cart-count');
  }

  async goto(slug: string) {
    await this.page.goto(`/products/${slug}`);
    await expect(this.addToCart).toBeEnabled();
  }

  async add() {
    const [resp] = await Promise.all([
      this.page.waitForResponse(r => r.url().includes('/api/cart') && r.request().method() === 'POST'),
      this.addToCart.click(),
    ]);
    expect(resp.ok()).toBeTruthy();
  }
}
```

`tests/pages/CheckoutPage.ts`

```ts
import { Page, Locator, expect } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly payWithSavedCard: Locator;
  readonly confirmation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.payWithSavedCard = page.getByTestId('checkout-pay-saved-card');
    this.confirmation = page.getByTestId('checkout-confirmation');
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async completeWithSavedCard() {
    await this.payWithSavedCard.click();
    await expect(this.confirmation).toBeVisible({ timeout: 10_000 });
  }
}
```

`tests/e2e/checkout.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ProductPage } from '../pages/ProductPage';
import { CheckoutPage } from '../pages/CheckoutPage';

test.describe('Checkout — saved card happy path', () => {
  test.use({ storageState: 'tests/.auth/shopper.json' });

  test('adds product and completes checkout', async ({ page }) => {
    const product = new ProductPage(page);
    const checkout = new CheckoutPage(page);

    await product.goto('blue-hoodie');
    await product.add();
    await expect(product.cartBadge).toHaveText('1');

    await checkout.goto();
    await checkout.completeWithSavedCard();
    await expect(checkout.confirmation).toContainText(/order #\d+/i);

    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(a11y.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  });

  test('shows out-of-stock error when inventory service returns 409', async ({ page }) => {
    await page.route('**/api/cart', route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'out_of_stock' }) }),
    );

    const product = new ProductPage(page);
    await product.goto('blue-hoodie');
    await product.addToCart.click();
    await expect(page.getByTestId('product-out-of-stock')).toBeVisible();
  });
});
```

### Example 2 — Login with UI credentials (Cypress)

Story: *As a registered user, I want to log in with email and password so that I reach my dashboard.*

`cypress/pages/LoginPage.ts`

```ts
export class LoginPage {
  visit() {
    cy.visit('/login');
    return this;
  }
  fill(email: string, password: string) {
    cy.get('[data-testid=login-email]').type(email);
    cy.get('[data-testid=login-password]').type(password, { log: false });
    return this;
  }
  submit() {
    cy.intercept('POST', '/api/session').as('login');
    cy.get('[data-testid=login-submit]').click();
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    return this;
  }
}
```

`cypress/e2e/login.cy.ts`

```ts
import { LoginPage } from '../pages/LoginPage';

describe('Login', () => {
  it('lands on dashboard after valid credentials', () => {
    new LoginPage().visit().fill(Cypress.env('USER_EMAIL'), Cypress.env('USER_PASSWORD')).submit();
    cy.location('pathname').should('eq', '/dashboard');
    cy.get('[data-testid=dashboard-greeting]').should('be.visible');
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ['serious', 'critical'] });
  });

  it('shows inline error on 401', () => {
    cy.intercept('POST', '/api/session', { statusCode: 401, body: { error: 'invalid_credentials' } }).as('login');
    new LoginPage().visit().fill('bad@example.com', 'nope').submit = function () {
      cy.get('[data-testid=login-submit]').click();
      cy.wait('@login');
      return this;
    };
    cy.get('[data-testid=login-error]').should('contain.text', 'Incorrect email or password');
  });
});
```

## Constraints

- Never emit `page.waitForTimeout`, `cy.wait(<ms>)`, `sleep`, or arbitrary delays. Use web-first assertions or request waits.
- Never use `nth-child`, XPath, or class-based selectors if a `data-testid` is available. If none exists, insert a `TODO(testid): add data-testid="..."` comment and warn in the report.
- Tests must be deterministic: any dynamic data must be seeded via a fixture.
- No authentication via UI inside the test body unless `auth_mode === 'ui-login'`; default is a pre-saved `storageState`.
- Each spec must assert at least one observable outcome per story step.
- Total length of generated spec under 250 lines; split otherwise.

## Quality checks

Before returning:
- [ ] Every `test` block has at least one `expect` / `should`.
- [ ] No `waitForTimeout` / `cy.wait(<number>)` anywhere in the diff.
- [ ] Every selector is a `getByTestId` / `[data-testid=...]` or an accessibility-first locator (`getByRole`).
- [ ] `playwright.config.ts` (or `cypress.config.ts`) has `screenshot: 'only-on-failure'` and `trace: 'retain-on-failure'` (Playwright) or `screenshotOnRunFailure: true` + `video: true` (Cypress).
- [ ] Inline axe assertion present on at least one terminal page.
- [ ] Network stub path covered for at least one non-happy flow.
- [ ] Files written under `specsDir` / `pageObjectsDir` — nothing outside the test tree.
