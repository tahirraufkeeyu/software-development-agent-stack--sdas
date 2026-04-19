---
name: refactor
description: Use when the user asks to clean up, simplify, rename, extract, inline, or restructure code without changing behaviour. Performs Fowler-style refactorings in small steps, running the test suite after every step; never proceeds when tests fail.
---

## When to use

- User says "refactor", "clean up", "extract a function", "rename", "split this class", "inline this helper".
- Code review found duplication, a god object, feature envy, or a long method and asked for a fix.
- Before adding a feature to code that is hard to change — refactor first, then add the feature.

Do not use this skill to change behaviour (that is a feature or bugfix). If a refactor reveals a bug, stop, note it, and address it as a separate change.

## Inputs

- A target (file, function, class, or module) and the refactoring to perform. If the user gives a goal ("this function is too long"), pick the smallest refactoring that moves toward the goal.
- A passing test suite. If the target has no tests, generate characterisation tests first (invoke the `test-writer` skill) and only then refactor.

## Outputs

- A sequence of small commits (or a single commit with a clear step-by-step description if the repo does not want many commits). Each step is individually behaviour-preserving and leaves the test suite green.
- A summary listing each refactoring applied with its Fowler name and the file/line it was applied to.

## Tool dependencies

- Read, Edit, Grep, Glob.
- The project's test runner; the project's formatter and linter.
- Optional: language-server-driven rename (`tsc --noEmit`, `pyright`, `gopls`, `rust-analyzer`) via CLI to catch broken references.

## Procedure

1. Confirm the safety net. Run the test suite. If it is red, stop — refactoring on a red suite is unsafe. If coverage for the target is absent, invoke `test-writer` to add characterisation tests.
2. Name the refactoring. Pick one from [references/refactoring-patterns.md](references/refactoring-patterns.md). If the intended change does not match a named refactoring, it is probably behaviour change in disguise — stop and clarify.
3. Plan the smallest safe step. Large refactorings are sequences of small ones: extract variable, then extract method, then move method, rather than one big rewrite.
4. Apply one step. Change only the files the step requires. Do not fix unrelated issues along the way.
5. Run the formatter. Run the linter. Run the tests. If anything fails, revert the step and reconsider (the step was too big, or missed a call site).
6. Commit the step with a message like `refactor: extract method sendWelcomeEmail from UserService.create` (Conventional Commits, see the `commit-message` skill).
7. Repeat from step 3 until the goal is reached.
8. Emit the summary listing the steps.

If the tooling supports safe rename (TS, Rust, Go with `gopls`), use it rather than hand-edits — it is mechanical and exhaustive.

## Examples

### Happy path: extract method + rename

Before (`src/orders/create.ts`, tests pass):

```ts
export async function createOrder(userId: string, items: Item[]) {
  // validate
  if (items.length === 0) throw new Error('empty');
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity');
    if (it.priceCents < 0) throw new Error('price');
  }

  // compute total
  let total = 0;
  for (const it of items) total += it.quantity * it.priceCents;

  // persist
  const id = await db.insert('orders', { userId, total, createdAt: Date.now() });
  for (const it of items) await db.insert('order_items', { orderId: id, ...it });
  return { id, total };
}
```

Step 1: extract method `validate` (run tests after).

```ts
function validate(items: Item[]) {
  if (items.length === 0) throw new Error('empty');
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity');
    if (it.priceCents < 0) throw new Error('price');
  }
}
```

Step 2: extract method `computeTotal`.

```ts
const computeTotal = (items: Item[]) =>
  items.reduce((s, it) => s + it.quantity * it.priceCents, 0);
```

Step 3: extract method `persist`. Run tests.

Step 4: rename `computeTotal` -> `sumLineItemsCents` using language-server rename. Run tests.

After:

```ts
export async function createOrder(userId: string, items: Item[]) {
  validate(items);
  const total = sumLineItemsCents(items);
  return persist(userId, items, total);
}
```

Summary:

```
1. extract-method: validate (src/orders/create.ts:3-10)
2. extract-method: computeTotal (src/orders/create.ts:13-14)
3. extract-method: persist (src/orders/create.ts:17-20)
4. rename: computeTotal -> sumLineItemsCents (language-server rename; 2 call sites updated)
```

### Edge case: replace conditional with polymorphism when new type keeps appearing

Before (Python):

```python
def discount(order):
    if order.kind == "retail":
        return 0
    elif order.kind == "wholesale":
        return 0.10 * order.total
    elif order.kind == "employee":
        return 0.25 * order.total
    raise ValueError(order.kind)
```

Every new customer type touches this function; tests exist for each branch.

Step 1: introduce a strategy protocol, keep the old function dispatching to it.

```python
class DiscountPolicy(Protocol):
    def rate(self, order: Order) -> float: ...

class Retail:
    def rate(self, order): return 0
class Wholesale:
    def rate(self, order): return 0.10
class Employee:
    def rate(self, order): return 0.25

POLICIES = {"retail": Retail(), "wholesale": Wholesale(), "employee": Employee()}

def discount(order):
    policy = POLICIES.get(order.kind)
    if not policy: raise ValueError(order.kind)
    return policy.rate(order) * order.total
```

Run tests — green.

Step 2: move `kind` onto `Order` as a `policy` field constructed at creation time; remove the dictionary lookup. Run tests.

Step 3: delete the now-unused string `kind` field and its migrations. Run tests and integration tests.

Each step was behaviour-preserving; the conditional is gone; adding a new customer type is now one new class.

## Constraints

- Never change behaviour. If an intended cleanup changes an observable output, stop and open a separate ticket.
- Never skip running tests between steps. "I am sure this is safe" is how silent regressions land.
- Never merge a refactor with a feature in the same commit; future bisect needs them separate.
- Do not reformat the whole file as part of a refactor. Run the formatter as a prior commit if drift is distracting.
- Do not rename public API symbols without a deprecation path if external consumers exist.
- Do not refactor without a test safety net; generate characterisation tests first.

## Quality checks

- `git diff <before>..<after>` shows the intended structural change and nothing else. No functional edits.
- Every intermediate commit passes the test suite.
- Linter output is unchanged or strictly better after each step.
- `rg <old_name>` returns zero results after a rename (no stale references in comments, docs, or templates).
- Public API is unchanged, or the rename is accompanied by a shim and a deprecation notice.
- A reviewer can read the commit list and understand the sequence without opening the diffs.
