---
name: ship-feature
description: Use when a developer has written code for a single feature and wants a full pre-commit gate (tests generated, code reviewed, commit message drafted) in one pass. Chains test-writer, code-review, and commit-message end-to-end and produces a single report summarising the run.
safety: writes-local
produces: .sdas/artifacts/developers/ship-feature-report.md
consumes:
chains:
  - test-writer
  - code-review
  - commit-message
---

## When to use

- Developer has finished writing a feature but has not yet committed.
- User says "ship this", "get this ready to commit", "wrap this up", or "prep this for PR".
- A feature branch has uncommitted work and the user wants the full pre-commit gate (tests + review + message) in a single flow.
- A teammate asks to hand off work and wants a one-shot summary of what changed and whether it is safe to land.

Do not use this for multi-feature branches (run once per feature), merge conflict resolution, or releasing/tagging (see `deploy-checklist`). Do not use this to actually run `git commit` — this orchestrator produces the message, it does not execute the commit.

## Chained skills

1. test-writer — reads the new/changed production code, infers repo test conventions, generates AAA tests for every observable behaviour, and emits the test file path(s).
2. code-review — reviews the combined diff (production + generated tests) against the security/correctness/performance/testing/observability checklist and returns severity-labelled findings.
3. commit-message — takes the staged diff (now including tests) and produces a Conventional Commits subject plus body.

## Inputs

- A path or glob identifying the changed production code (e.g. `src/pricing/discount.ts`, or "whatever is in `git diff`").
- Optional: the feature's ticket id (`JIRA-1234`, `GH-456`) for the commit footer.
- Optional: the target base branch if not `main`/`master` (defaults to the repo's default branch).

## Outputs

- Generated test file(s) written in the location dictated by the repo's convention (via test-writer).
- `.sdas/artifacts/developers/ship-feature-report.md` containing:
  - The list of test files generated and the behaviours they pin down.
  - The full code-review output (verdict, findings table, inline suggestions).
  - The proposed commit message (subject + body + footers) ready to paste into `git commit -F`.
  - A final `Status:` line: `ready-to-commit` or `halted-high-severity`.

## Tool dependencies

- Bash (to run `git status`, `git diff`, `git diff --cached`, and the repo's test command).
- Read, Grep, Glob, Edit, Write (used transitively by the chained skills).
- The project's test runner on `PATH`: one of `npx jest`, `npx vitest`, `pytest`, `go test ./...`, `cargo test`, `bundle exec rspec`.
- Optional: GitHub MCP if the user passes a PR URL instead of a local diff.

## Procedure

1. Collect the diff. Run `git status --porcelain` and `git diff` (unstaged) plus `git diff --cached` (staged). If both are empty, halt with `no changes detected — nothing to ship`.
2. Invoke `test-writer` on the changed production files. Pass the file list; do not pass any generated test files back as target (infinite loop). Capture the returned list of new/updated test paths.
3. Run the test command the repo already uses. Detect it in this order: `package.json > scripts.test`, `pyproject.toml > [tool.pytest.ini_options]`, `go.mod` (use `go test ./...`), `Cargo.toml` (use `cargo test`), `Gemfile` (`bundle exec rspec`). If any of the newly generated tests fail, return control to test-writer with the failure output. Halt after one retry if still failing.
4. Stage the production changes and the new test files: `git add <prod-files> <test-files>`.
5. Invoke `code-review` on `git diff --cached`. Capture the verdict and findings.
6. Gate on severity. If the findings include any `blocker` or `high` entry, set `Status: halted-high-severity`, write the report, and stop. Do not proceed to commit-message. Tell the user exactly which file:line needs the fix.
7. If no high-severity findings, invoke `commit-message` on `git diff --cached`. Pass the optional ticket id so it lands in the `Refs:` footer.
8. Write `.sdas/artifacts/developers/ship-feature-report.md` with the three sections below and the final `Status:` line. Print the commit message to the user as a fenced code block so they can copy/paste into `git commit -F -`.
9. Do not run `git commit`. The user owns that step.

Report structure:

```markdown
# ship-feature report — <short feature name>

## Tests generated
- <test file path> — <N tests> covering <behaviour list>

## Code review
Verdict: <approve | approve-with-nits | request-changes | block>
<findings table from code-review>

## Proposed commit message
```
<subject>

<body>

Refs: <ticket>
```

Status: ready-to-commit
```

## Examples

### Example 1 — happy path (TypeScript, calculateDiscount)

Input: the user ran `git status` and has one unstaged file.

```
 M src/pricing/discount.ts
```

`src/pricing/discount.ts` (new function):

```ts
export function calculateDiscount(subtotalCents: number, tier: 'bronze' | 'silver' | 'gold'): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents < 0) throw new RangeError('subtotal');
  const rate = tier === 'gold' ? 0.15 : tier === 'silver' ? 0.1 : 0.05;
  return Math.round(subtotalCents * rate);
}
```

Step 2 — test-writer emits `src/pricing/discount.test.ts`:

```ts
import { calculateDiscount } from './discount';

describe('calculateDiscount', () => {
  it.each([
    ['bronze', 10000, 500],
    ['silver', 10000, 1000],
    ['gold', 10000, 1500],
  ])('applies the %s tier rate', (tier, subtotal, expected) => {
    expect(calculateDiscount(subtotal, tier as any)).toBe(expected);
  });

  it('rounds to the nearest cent', () => {
    expect(calculateDiscount(199, 'silver')).toBe(20); // 19.9 -> 20
  });

  it('throws RangeError for negative subtotal', () => {
    expect(() => calculateDiscount(-1, 'gold')).toThrow(RangeError);
  });
});
```

Step 3 — `npx jest src/pricing/discount.test.ts` reports 5 passed.

Step 5 — code-review output:

```
Verdict: approve
No findings. Input validation guards RangeError; pure function; tests cover all three tiers, rounding, and the negative-input branch.
```

Step 7 — commit-message output:

```
feat(pricing): add calculateDiscount for tiered orders

Introduce a pure helper that returns the discount in cents for bronze,
silver, and gold customers. Input is validated and results are rounded
to the nearest cent to match the Stripe amount convention used
elsewhere in the pricing module.

Refs: JIRA-4812
```

Step 8 — final `Status: ready-to-commit` written to `.sdas/artifacts/developers/ship-feature-report.md`.

### Example 2 — halt path (Python, SQL injection)

Input:

```
 M app/reports/query.py
```

`app/reports/query.py`:

```python
def fetch_report(conn, user_id: str):
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM reports WHERE user_id = '{user_id}'")
    return cursor.fetchall()
```

Step 2 — test-writer emits `tests/reports/test_query.py` with a happy-path test plus a parametrised empty-result test.

Step 3 — `pytest tests/reports/test_query.py` reports 2 passed.

Step 5 — code-review output:

```
Verdict: block

| Severity | File:Line                      | Category | Issue                                                       | Suggested fix                                  |
|----------|--------------------------------|----------|-------------------------------------------------------------|------------------------------------------------|
| high     | app/reports/query.py:L3        | security | String-interpolated SQL — user_id is attacker-controlled   | Use a parameterised query: `cursor.execute("SELECT * FROM reports WHERE user_id = %s", (user_id,))` |
```

Step 6 — orchestrator halts. It does NOT invoke commit-message. The report ends with:

```
Status: halted-high-severity

Action required:
  app/reports/query.py:3 — replace f-string with a parameterised query, then re-run `ship-feature`.
```

## Constraints

- Do not skip a step on failure. If test-writer fails, retry once, then halt. If the generated tests fail, halt — do not silently delete them.
- Do not proceed past code-review when any `blocker` or `high` finding is present. Medium/low/info do not block the flow but are included verbatim in the report.
- Do not execute `git commit` or `git push`. The orchestrator stops at "here is the message".
- Do not modify production code to silence a code-review finding. That is the user's decision.
- Do not re-run test-writer on files that test-writer itself just produced.
- Do not write the report anywhere other than `.sdas/artifacts/developers/ship-feature-report.md` — downstream tooling reads that exact path.
- Do not invent a ticket id. If none is supplied, omit the `Refs:` footer.

## Quality checks

- The artifact exists at `.sdas/artifacts/developers/ship-feature-report.md` and contains all three sections plus a terminal `Status:` line.
- Every test file listed in the report exists on disk and the test runner exits 0 when pointed at it.
- `git diff --cached` is non-empty and includes both production and test files before code-review runs.
- The commit message subject is <= 72 characters and matches the repo's existing Conventional Commits style (verify by running `git log -n 10 --pretty=format:'%s'` and comparing types/scopes).
- When `Status: halted-high-severity`, the report contains at least one `high` or `blocker` finding with a cited `file:line`.
- When `Status: ready-to-commit`, the findings table has zero rows of `high` or higher severity.
- Running the orchestrator twice on the same clean tree is idempotent: the second run reports `no changes detected — nothing to ship` and does not rewrite the artifact.
