---
name: debug
description: Use when the user reports a bug, a failing test, an unexpected output, a production incident, or a behaviour that diverges from expectation. Runs a structured session — reproduce, isolate, hypothesise, verify, fix, and add a regression test — and never ships a "fix that coincidentally works".
---

## When to use

- User pastes an error, stack trace, failing test, or describes incorrect behaviour.
- Something works in staging but fails in production (or vice versa).
- A commit or dependency upgrade introduced a regression; `git bisect` is the right tool.
- A flaky test needs diagnosis (not just a retry).

Do not use this skill to write new features, to review a PR, or to answer "how do I use library X" — those are separate skills.

## Inputs

- Symptom description, with as much context as the user has: error message, stack trace, steps to reproduce, environment (OS, runtime version, recent deploys).
- Access to logs, metrics, or a reproducible environment if possible.

## Outputs

- A short session report with six sections: Symptom, Reproduction, Isolation, Hypothesis, Verification, Fix + Regression test.
- A patch that fixes the root cause (not just the symptom).
- At least one new automated test that fails on the pre-fix code and passes on the post-fix code.

## Tool dependencies

- Read, Grep, Glob, Edit for code.
- Bash for the test runner, `git bisect`, `git log`, and language-specific debuggers (`pdb`, `node --inspect`, `dlv`, `lldb`, `rust-gdb`).
- Optional: a log aggregator MCP, or a profiler when the bug is performance-shaped.

## Procedure

1. Symptom: restate the bug in one sentence. Include the expected behaviour next to the observed behaviour. If these two sentences are not both concrete and observable, ask the user to make them so before continuing.
2. Reproduce locally. A bug you cannot reproduce you cannot fix with confidence. Steps:
   - Capture the exact input and environment.
   - Reduce to the smallest failing case: shrink the input, strip unrelated configuration, run with a single worker, drop from integration to unit scope if possible.
   - If the bug needs a specific wall-clock or RNG, fake them.
   - If it is race-conditiony, run the repro in a loop (`while pytest -x; do :; done`) for at least a minute or use a deterministic scheduler.
   - If it is environment-specific, document the minimal environment. Never skip this step with "I'll just trust the logs".
3. Isolate with binary search. If the bug appeared after some change, run `git bisect`:
   ```
   git bisect start
   git bisect bad HEAD
   git bisect good <last-known-good>
   git bisect run <script-that-exits-nonzero-on-bug>
   ```
   For data-shape bugs, bisect inputs instead of commits: halve the failing input until the minimum repro is obtained.
4. Hypothesise. Before editing any code, write down the hypothesis: "the bug is caused by X because Y, which implies the symptom Z". If you cannot finish that sentence, you do not understand the bug yet — go back to step 2.
5. Verify the hypothesis. Make a cheap observation that would distinguish the hypothesis from its competitors: add a log, set a breakpoint, run an assertion, query the DB. Confirm the hypothesis matches reality end-to-end — not "the symptom went away" but "the predicted intermediate state is present".
6. Fix the root cause, not the symptom. A patch that makes the failing test pass can still be a coincidence. Specifically:
   - If you added a null-check, explain why the value is null and whether upstream is the real fault.
   - If you added a retry, explain why the first attempt fails and whether retry is an acceptable policy.
   - If you added a `try/except`, explain what invariant was actually violated.
   Record the causal chain in the report.
7. Add a regression test. The test must fail on the pre-fix code and pass after. Invoke the `test-writer` skill to place and name it conventionally. If the bug was a race, the test must deterministically reproduce it (synchronised scheduler, controlled clock); a probabilistic test is unacceptable.
8. Verify the fix does not regress neighbours. Run the full test suite plus any integration/e2e gates. For performance bugs, run the relevant benchmark.
9. Write the report. Keep it short; link logs and commits rather than pasting them. Example format below.

## Examples

### Happy path: null pointer on a specific customer

Report:

```
Symptom: POST /checkout/:cart returned 500 only for carts containing
gift-wrapped items. Stack trace pointed to `giftMessage.length` on null.

Reproduction: unit test fixture `cartWithGiftNoMessage.json` reliably
reproduces the 500. No clock/RNG needed.

Isolation: the null check was removed in 9f3c1a2b ("refactor: simplify
gift flow"). That commit assumed the DB migration had backfilled
`gift_message`. Verified via `SELECT count(*) FROM cart_items
WHERE gift_wrap AND gift_message IS NULL;` -> 412 rows.

Hypothesis: the backfill was written but never run in production; the
refactor silently dropped the defensive null-check and relied on an
invariant that does not hold.

Verification: ran the backfill on a staging copy; symptom disappears.
Re-ran on pre-backfill snapshot; symptom returns. Hypothesis confirmed.

Fix: (a) reintroduce a null-safe accessor `giftMessage ?? ""`; (b) run
the backfill migration in production; (c) add a NOT NULL DEFAULT ''
constraint so the invariant is enforced by the DB going forward.

Regression test: tests/checkout/gift.test.ts::"checkout succeeds when
gift_message is null" -> fails on 9f3c1a2b, passes on this commit.
```

### Edge case: the fix made the symptom disappear but the root cause was elsewhere

Suppose a flaky test goes green after `sleep(100)` is inserted. This is the classic "coincidental fix".

What the skill demands instead:

- Identify which event the test was racing with. For a UI test: a pending XHR, a debounced handler, a font load. For a worker test: a queue ack that had not yet propagated.
- Replace `sleep` with a deterministic wait on the real event (`await waitFor(() => expect(...)...)`, `queue.drain()`, `synctest.Wait()`).
- Document why `sleep` "worked": it masked the race by being larger than the typical event latency, but will still flake under load.

Final fix: deterministic synchronisation primitive. Regression test: reproduces the race under `-count=100 -race` or equivalent and passes.

## Constraints

- Never ship a fix without a reproducing test.
- Never conclude from "it works now" alone. Demonstrate that the hypothesised cause was present and is now gone.
- Never add broad `try/except Exception: pass` as a "fix".
- Never fix a symptom in a way that hides future occurrences of the same class (e.g., swallow the error; add a sleep; increase a retry budget) unless you explicitly document that as the chosen trade-off.
- Do not guess at multiple fixes in parallel. Change one variable at a time.
- Do not edit production code before you have a local repro, unless the user explicitly accepts that risk during an active incident.

## Quality checks

- The report contains all six sections.
- The regression test fails on `git stash && <test>` and passes after `git stash pop`.
- Full test suite passes.
- The commit message (via the `commit-message` skill) is a `fix` with a body explaining the why.
- If `git bisect` was used, the guilty commit is named in the report.
- If the bug touched a shared subsystem (auth, billing, data storage), a short postmortem entry is queued for the next review.
