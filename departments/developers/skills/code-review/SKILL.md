---
name: code-review
description: Use when a user asks for a review of a diff, pull request, patch, or staged changes. Produces a structured review covering security, correctness, performance, style, and tests with severity-labelled findings and concrete fix suggestions tied to file and line.
safety: safe
---

## When to use

- User pastes a diff, patch, or PR URL and asks "review this", "is this safe to merge", "look for issues".
- User asks to self-review staged changes before committing (`git diff --staged`).
- User wants a security- or performance-focused pass on a specific file.
- User mentions N+1, SQL injection, XSS, authorization, race conditions, or unbounded loops.

Do not use this skill for architectural review of a design doc (use `api-design` or an ADR skill) or for large multi-PR audits (run this skill per PR).

## Inputs

- A unified diff, a PR URL (resolved via the GitHub MCP), or a list of files to review.
- Optional: the language/framework (inferred if omitted), the repo's style guide or linter config, and the PR description so intent can be compared against implementation.

## Outputs

A Markdown review with three sections:

1. Summary: 2-4 sentence assessment plus an overall verdict (`approve`, `approve-with-nits`, `request-changes`, `block`).
2. Findings table: one row per issue with columns `Severity | File:Line | Category | Issue | Suggested fix`.
3. Inline suggestions: for each `high` or `blocker` finding, a fenced code block showing the exact replacement.

Severity ladder: `blocker` (must fix, ship-stopping), `high` (fix before merge), `medium` (fix soon, track in issue), `low` (nit, optional), `info` (observation, no action).

## Tool dependencies

- Read, Grep, Glob for local files.
- GitHub MCP (`get_pull_request`, `get_pull_request_diff`, `get_pull_request_files`) when reviewing a PR by URL.
- Optional: language-specific linters (`eslint`, `ruff`, `golangci-lint`, `clippy`) — run them if available and cite their output.

## Procedure

1. Fetch the diff. If given a PR URL, use the GitHub MCP to pull the title, body, and unified diff. If given a branch, run `git diff <base>...HEAD`. Always obtain the full diff, not a summary — reviews over summarised diffs miss subtle bugs.
2. Read the PR description and identify the stated intent. Note any mismatch between intent and the actual changes; call that out in the summary.
3. Enumerate touched files and, for each non-trivial file, read at least 50 lines above and below the hunk to understand context. Never review a hunk in isolation.
4. Walk the checklist in [references/review-checklist.md](references/review-checklist.md) in order: security, correctness, performance, maintainability, testing, observability. Skipping a category is not acceptable; if a category does not apply, state so explicitly in the summary.
5. For each issue, assign a severity from the ladder above and write the finding using this template: `<what is wrong> -> <why it matters> -> <concrete fix>`. Always cite `path/to/file.ext:Lstart-Lend`.
6. Cross-check every flagged issue against [references/common-antipatterns.md](references/common-antipatterns.md) to ensure the label is precise (e.g. distinguish feature envy from law-of-demeter violations).
7. If the diff touches tests, confirm the tests actually exercise the new behaviour. A passing test that never asserts the new code path is a `high` finding.
8. If any finding is `blocker` or `high`, set the verdict to `request-changes` or `block`. Never mark a PR `approve` while `high` issues remain.
9. Emit the review in the output format above. Keep each finding under four lines; push rationale into links to the references.

## Examples

### Happy path: Node.js route with SQL and authorization gaps

Input diff (excerpt):

```ts
// src/routes/users.ts
router.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);
  res.json(user.rows[0]);
});
```

Review output:

```
Verdict: block

Findings
| Severity | File:Line | Category | Issue | Fix |
| blocker | src/routes/users.ts:3 | security | String-interpolated SQL query -> SQL injection via `id` path param | Use parameterised query: db.query('SELECT ... WHERE id = $1', [id]) |
| blocker | src/routes/users.ts:1-5 | security | No authz check -> any authenticated user can read any user record | Add requireSelfOrAdmin(req.user, id) before the query |
| high    | src/routes/users.ts:4 | correctness | No null check on user.rows[0] -> responds with undefined as 200 on missing id | Return 404 when rows.length === 0 |
| medium  | src/routes/users.ts:4 | security | SELECT * leaks password_hash, email_verification_token | Select explicit columns; never return hashes |
```

Inline suggestion for the SQL injection finding:

```ts
const { rows } = await db.query(
  'SELECT id, email, name FROM users WHERE id = $1',
  [req.params.id],
);
if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
if (!canRead(req.user, rows[0].id)) return res.status(403).end();
res.json(rows[0]);
```

### Edge case: diff looks fine in isolation but regresses a caller

Input diff: a refactor renames `getUserOrThrow` to `getUser` and changes it to return `null` instead of throwing. The diff itself is clean, linted, and tested.

Review output:

```
Verdict: request-changes

Findings
| high | src/services/user.ts:42 | correctness | Return type changed from User to User|null but 6 callers still dereference the result without null-check | Either keep the throwing variant under the old name and add getUser as a new function, or update all callers. `rg 'getUserOrThrow\(' -n` finds them. |
| info | src/services/user.ts:42 | observability | Converting throw -> null silently drops a previously-logged not-found event | Preserve the warn-level log or emit a metric |
```

This is the hallmark of a good review: the local change is fine; the global change is not. Always grep for callers when a signature changes.

## Constraints

- Never mark a review `approve` when any `blocker` or `high` finding remains open.
- Never invent line numbers. If you cannot see a line, fetch more of the file.
- Never critique code that is not in the diff unless it is a caller affected by the diff.
- Do not rewrite the entire file as a "suggested fix"; suggest the minimal patch.
- Do not produce positive-sounding filler ("looks good overall", "nice refactor") unless you also list the categories you checked and found clean.
- Never include emojis in review output.

## Quality checks

- Every finding has a severity label, a `path:line` reference, and a concrete fix.
- The six checklist categories are each either cited in a finding or explicitly marked as "n/a" with a one-line reason.
- If the diff changes an exported signature, a caller grep was performed.
- If the diff touches SQL, raw HTML rendering, `eval`/`Function`/`exec`, deserialisation, file path handling, shell execution, or auth, there is at least one security finding or an explicit "checked and clean" note for each.
- The verdict is consistent with the severities present.
