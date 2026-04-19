# Testing conventions

Principles and patterns that make tests useful instead of painful. Cite these in reviews and skill outputs.

## AAA: Arrange, Act, Assert

Structure every test in three visually-separated blocks.

```ts
it('applies the coupon once per cart', () => {
  // Arrange
  const cart = aCart().withItem(product(10_00)).build();
  const coupon = aCoupon().tenPercentOff().build();

  // Act
  const total = applyCoupon(cart, coupon);

  // Assert
  expect(total).toBe(9_00);
});
```

A test with two Act steps is really two tests — split it.

## One behaviour per test

Name tests after behaviours, not after method names. Compare:

- Bad: `test_calculate_total_1`, `test_calculate_total_2`.
- Good: `returns zero for an empty cart`, `applies tax after discounts`, `throws when a line-item quantity is negative`.

The test name is the specification. A reader should be able to learn the contract from the list of test names alone.

## Do not mock the code under test

The only legitimate test double is for a collaborator the unit under test depends on (DB, network, clock, message bus). Mocking the unit itself turns the test into a tautology.

Red flag in Jest:

```ts
jest.mock('./order-service');           // this is the file under test — wrong
```

Acceptable:

```ts
jest.mock('./payment-gateway');          // external collaborator — ok
```

Prefer real implementations where cheap: in-memory DB, ephemeral temp dir, stubbed HTTP with a recording.

## Test data builders

Inline literals rot. A builder isolates tests from schema churn.

```ts
// tests/support/builders.ts
export const aUser = () => ({
  id: 'u_1',
  email: 'a@b.test',
  role: 'member' as Role,
  withRole(role: Role) { return { ...this, role }; },
  build() { const { withRole, build, ...rest } = this; return rest; },
});
```

Tests read as "a user with role admin", not as a wall of fields most of which do not matter to the test.

For Python, `factory_boy`; for Go, a plain `func newUser(opts ...func(*User)) *User`; for Ruby, `FactoryBot`.

## Deterministic time, randomness, IDs

- Clock: inject a `Clock` interface or use `sinon.useFakeTimers`, `freezegun`, `time.Now` injection, `testing/synctest`.
- RNG: seed it. `Math.seedrandom`, `random.seed(0)`, `rand.New(rand.NewSource(0))`.
- UUIDs: inject an ID generator; in tests return `'uuid-1'`, `'uuid-2'`.
- Timezone: set `TZ=UTC` in the test runner; never rely on the machine's locale.

If a test uses `Date.now()` directly, it is broken — it just has not been caught yet.

## Avoid shared mutable fixtures

A fixture shared across tests ("`seedDb()` at suite start") couples tests. Prefer:

- Per-test transaction rolled back at teardown.
- Unique namespaces (random table suffix, unique org id).
- Pure factories returning fresh objects.

## Snapshot testing pitfalls

Snapshots are load-bearing strings. They catch accidental output changes but also encourage complacency.

Rules:

- Only snapshot stable output (rendered HTML, canonical JSON with sorted keys). Never snapshot log output or a stringified error with a stack trace.
- Keep snapshots small (< 30 lines). A 500-line snapshot is not a test; it is a photograph.
- Review snapshot diffs like code. `--updateSnapshot` without reading the diff is a process failure.
- Never snapshot values that include timestamps, random IDs, or file paths without redaction.

## Test doubles: know the five kinds

- Dummy: passed in, never used. (`null` for an unused arg.)
- Stub: returns canned answers. ("`repo.findById` returns `user`".)
- Fake: working but simplified. (In-memory repo.)
- Spy: records calls. (`jest.fn()` you later inspect.)
- Mock: preprogrammed with expectations. (Fails the test if not called exactly as prescribed.)

Prefer fakes over mocks. Mocks encode how the code works; fakes encode what it does. When the implementation changes, mock-heavy suites break gratuitously.

## Property-based testing

For pure functions with algebraic properties, use `fast-check` / `hypothesis` / `quickcheck`:

```ts
import fc from 'fast-check';
test('serialise then parse is identity', () => {
  fc.assert(fc.property(fc.record({ id: fc.uuid(), name: fc.string() }),
    u => expect(parse(serialise(u))).toEqual(u)));
});
```

## Error-path coverage

For every `throw`, `return error`, or early return, add a test that triggers it. If a branch is unreachable, delete the branch.

## Async and concurrency

- Always `await` async calls in tests. An unresolved promise is a silent pass in Jest < 27.
- For concurrency bugs, use deterministic schedulers (`fc.scheduler`, Go's `testing/synctest`, Loom in Java).
- Avoid `sleep` in tests. Poll with a hard timeout and a tight interval, or use synchronisation primitives the code exposes.

## Test speed budget

Keep unit tests under 100 ms each. A suite over 60 seconds loses its feedback value. Mark anything slow as `@slow` / `-tags=integration` and run separately.

## What not to test

- Third-party libraries. (Trust them or don't use them.)
- Language features. (`Array.map` works; do not test it.)
- Getters and setters with no logic.
- Private implementation details — test through the public API.

## Characterisation tests (for legacy code)

When you do not understand the code but must change it, pin the current behaviour first:

1. Call it with representative inputs.
2. Capture outputs as assertions (snapshots are ok here).
3. Refactor; tests fail -> investigate; tests pass -> proceed.

This is the refactor skill's precondition.
