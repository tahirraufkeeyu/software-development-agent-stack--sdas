---
name: test-writer
description: Use when the user asks to "write tests for", "add unit tests", "cover this function", or needs a regression test for a bug. Reads existing tests to infer the repo's conventions (framework, file layout, naming, setup/teardown, fixtures), then generates AAA-style tests for a target file or function, including deterministic edge cases.
---

## When to use

- User points at a file, function, or class and asks for tests.
- A bug was just fixed and a regression test is needed.
- Coverage report flagged an untested branch and the user wants it filled.
- New function was added alongside a feature and the PR review asked for tests.

Do not use this skill to design a test strategy for an entire service (use a broader testing-strategy skill) or to write end-to-end browser tests (those require a separate harness skill).

## Inputs

- Target under test: a file path, or a file path plus a list of function/class/method names.
- Optional: a specific bug description ("reproduce this failure mode first, then fix-verify") or a branch in the code that must be covered.

## Outputs

- One or more test files placed where the repo's convention expects them.
- Every new test function follows Arrange-Act-Assert, names the behaviour, and is deterministic.
- A short summary listing each test added with the behaviour it pins down and the branch it covers.

## Tool dependencies

- Read, Glob, Grep for inspecting the existing test suite.
- Edit / Write for creating or updating test files.
- Ability to run the project's test command (the user should run it — do not assume a sandbox).

## Procedure

1. Locate existing tests. Use Glob on common patterns: `**/*.test.ts`, `**/*.spec.ts`, `**/test_*.py`, `**/*_test.go`, `tests/**/*.rs`, `spec/**/*_spec.rb`. Read 2-3 representative files.
2. Infer conventions and record them before writing:
   - Framework (Jest, Vitest, Mocha, pytest, unittest, go test + testify, Rust `#[test]`, RSpec).
   - File location: sibling (`foo.ts` -> `foo.test.ts`) vs mirrored tree (`src/foo.ts` -> `tests/foo.test.ts`).
   - Naming (`describe/it` vs `test(...)` vs `class TestFoo` vs `TestFoo_Bar`).
   - Setup/teardown (`beforeEach`, `pytest` fixtures, `TestMain`, `TestFixture`).
   - Assertion style (`expect().toEqual()`, `assert ==`, `require.Equal`, etc.).
   - Test data: factories/builders vs inline literals vs JSON fixtures.
   - Mocking library if any (`jest.mock`, `unittest.mock`, `gomock`, `mockito`).
   - Coverage tool and thresholds if configured (`jest.config`, `pyproject.toml [tool.coverage]`, `go test -cover`).
3. Read the target code. List every observable behaviour: normal case, each error/return branch, boundary values (0, 1, max, empty, `None`/`null`), and every external effect (DB write, event emit, HTTP call).
4. Design one test per behaviour, not one test per method. Name each test after the behaviour: `returns 404 when user is missing`, not `test_get_user_3`.
5. For each test apply the AAA template:
   - Arrange: build inputs with the repo's factory/builder or inline; stub collaborators but never the unit under test.
   - Act: one call to the unit under test.
   - Assert: observable outcome — return value, thrown error, published event, DB state, rendered output. Avoid asserting on internal calls unless that is the contract.
6. Make every test deterministic: fake the clock, seed the RNG, fix timezone to UTC, stub network with the repo's chosen library (`nock`, `responses`, `httptest`, `wiremock`). Never let a test touch the real network or wall clock.
7. Cover the negative space: invalid input, expired token, empty collection, duplicate key, concurrent write (if applicable), cancellation. At minimum add one "sad path" test per public function.
8. For a bugfix, write the failing test first. Confirm it reproduces the bug against the un-patched code (describe this in the summary, e.g. "this test fails at commit `abc123`").
9. Run the test command. If any test fails that is not an intended reproduction, fix the test — never relax an assertion to make it pass.
10. Emit a summary: new test files, count of tests added, which branches are now covered. Link each test name to the behaviour it pins down.

See [references/testing-conventions.md](references/testing-conventions.md) for the principles these steps operationalise.

## Examples

### Happy path: pure function in TypeScript (Jest)

Target:

```ts
// src/money/tax.ts
export function withTax(amountCents: number, rate: number): number {
  if (!Number.isFinite(amountCents) || amountCents < 0) throw new RangeError('amount');
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new RangeError('rate');
  return Math.round(amountCents * (1 + rate));
}
```

Generated `src/money/tax.test.ts`:

```ts
import { withTax } from './tax';

describe('withTax', () => {
  it('adds tax and rounds to the nearest cent', () => {
    expect(withTax(1000, 0.2)).toBe(1200);
    expect(withTax(199, 0.2)).toBe(239); // 238.8 -> 239
  });

  it('returns the amount unchanged when rate is zero', () => {
    expect(withTax(1234, 0)).toBe(1234);
  });

  it('handles zero amount', () => {
    expect(withTax(0, 0.25)).toBe(0);
  });

  it.each([
    ['negative amount', -1, 0.1],
    ['NaN amount', Number.NaN, 0.1],
    ['Infinity amount', Number.POSITIVE_INFINITY, 0.1],
  ])('throws RangeError for %s', (_label, amount, rate) => {
    expect(() => withTax(amount, rate)).toThrow(RangeError);
  });

  it.each([
    ['negative rate', 100, -0.01],
    ['rate > 1', 100, 1.01],
  ])('throws RangeError for %s', (_label, amount, rate) => {
    expect(() => withTax(amount, rate)).toThrow(RangeError);
  });
});
```

### Edge case: repo uses pytest, target has a clock and a DB

Inferred conventions (from reading `tests/conftest.py`): pytest, factory-boy for builders, a `frozen_time` fixture that wraps `freezegun`, a `db` fixture that yields a transaction rolled back at teardown.

Target:

```python
# app/subscriptions/renewal.py
def schedule_renewal(sub: Subscription, now: datetime, db: Session) -> datetime:
    if sub.status != "active":
        raise DomainError("only active subscriptions can renew")
    next_at = now + timedelta(days=sub.period_days)
    db.add(RenewalJob(sub_id=sub.id, run_at=next_at))
    return next_at
```

Generated `tests/subscriptions/test_renewal.py`:

```python
import pytest
from datetime import datetime, timezone
from app.subscriptions.renewal import schedule_renewal
from app.errors import DomainError
from tests.factories import SubscriptionFactory

NOW = datetime(2026, 4, 19, 12, 0, tzinfo=timezone.utc)

class TestScheduleRenewal:
    def test_schedules_a_job_period_days_from_now(self, db, frozen_time):
        frozen_time.move_to(NOW)
        sub = SubscriptionFactory(status="active", period_days=30)
        next_at = schedule_renewal(sub, now=NOW, db=db)
        assert next_at == datetime(2026, 5, 19, 12, 0, tzinfo=timezone.utc)
        jobs = db.query(RenewalJob).filter_by(sub_id=sub.id).all()
        assert len(jobs) == 1 and jobs[0].run_at == next_at

    @pytest.mark.parametrize("status", ["cancelled", "paused", "past_due"])
    def test_rejects_non_active_subscriptions(self, db, status):
        sub = SubscriptionFactory(status=status)
        with pytest.raises(DomainError, match="only active"):
            schedule_renewal(sub, now=NOW, db=db)
        assert db.query(RenewalJob).count() == 0
```

Summary output to the user:

```
tests/subscriptions/test_renewal.py (new)
  - schedules a job period_days from now         -> happy path, covers the DB write
  - rejects non-active subscriptions (3 cases)   -> covers the guard + ensures no side effect
```

## Constraints

- Never mock the unit under test. Mock only its collaborators.
- Never write `expect(true).toBe(true)` or tests without assertions.
- Never reach real network, real clock, real filesystem outside a tmp dir, or real RNG without a seed.
- Do not assert on log lines unless the contract is "this must log".
- Do not add a test that already exists. Grep the suite first.
- Do not change production code to make a test easier, unless the production code has a testability bug — if you do, call it out and keep the change minimal.
- Do not introduce a new test framework or runner silently. Match what the repo already uses.

## Quality checks

- Each test name describes a behaviour in plain English.
- Each test has exactly one Act step and at least one meaningful assertion.
- No test depends on test ordering. Run the file in reverse and shuffled; it must still pass.
- Running the file twice back-to-back is stable (no leaked state, no clock drift).
- If the target has N branches, there are at least N tests. Run a coverage report to confirm.
- For a bugfix: checkout the pre-fix commit, run the new test, verify it fails; checkout the fix, verify it passes.
