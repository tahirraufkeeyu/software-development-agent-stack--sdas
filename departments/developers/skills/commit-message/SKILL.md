---
name: commit-message
description: Use when the user asks to write a commit message, draft a commit, or finalise a commit for a staged diff. Produces a Conventional Commits subject, optional body explaining the why, and BREAKING CHANGE footer when the diff changes a public contract.
safety: safe
---

## When to use

- User runs `git add` and asks for a commit message.
- User pastes a diff and asks "what's a good commit message for this".
- User finishes a task and asks the agent to commit (combine with a separate `commit` tool/skill that actually runs git).

Do not use this skill to write a PR description (longer, audience-different) or a changelog entry (see the `documentation` skill).

## Inputs

- A staged diff (`git diff --cached`) or an unstaged diff. If none is provided, fetch `git status` and `git diff --cached` from the repo.
- Optional: related issue/ticket id, prior commit for context, the branch name if it encodes intent.

## Outputs

A commit message with:

- Subject line: `<type>[optional scope][!]: <imperative summary>`, <= 72 characters.
- Optional body: wrapped at 72 columns, explaining the why, constraints considered, alternatives rejected.
- Optional footers: `Refs: #123`, `Closes: #123`, `BREAKING CHANGE: <what>`, `Co-authored-by: ...`.

## Tool dependencies

- Bash for `git status`, `git diff --cached`, `git log -n 20 --oneline` (style calibration).
- Read/Grep to glance at touched files when the diff alone is ambiguous.

## Procedure

1. Read the diff. If it is empty, ask for the staged changes or run `git diff --cached`.
2. Calibrate to the repo's style. Run `git log -n 20 --pretty=format:'%s'`. If the repo already uses Conventional Commits, match exactly (types, scope format, capitalisation). If not, propose Conventional Commits and follow the user's existing conventions where they conflict.
3. Classify the change into one type:
   - `feat` — a user-facing new capability.
   - `fix` — a bug fix observable to users or other systems.
   - `perf` — a change that improves performance without changing behaviour.
   - `refactor` — internal restructuring, no behaviour change.
   - `docs` — documentation only.
   - `test` — tests only.
   - `build` — build system, dependencies, packaging.
   - `ci` — CI/CD configuration.
   - `chore` — maintenance (bumping deps, cleanup) that is neither feat nor fix.
   - `revert` — reverts a previous commit.
4. Pick a scope if the repo uses them. Scope is usually a package, module, or subsystem (`auth`, `api`, `billing`). Omit the scope entirely rather than invent one.
5. Write the subject as an imperative phrase starting lowercase after the colon. "Add", "fix", "rename", never "added" or "adds". Cap at 72 characters; aim for <= 50.
6. Decide on a body:
   - If the diff is a one-liner obvious from the subject, no body.
   - Otherwise, a body answering: why is this change needed; what is the approach; what alternatives were considered and rejected; what risks remain.
   - Hard-wrap at 72 columns. Separate subject and body with one blank line.
7. Add footers:
   - `Refs: #<n>` or `Closes: #<n>` when linked to an issue.
   - `BREAKING CHANGE: <description>` when the diff removes or alters a public API, wire format, CLI flag, config key, database column, or event shape. Also append `!` before the colon in the subject.
   - `Co-authored-by:` when pair programming.
8. Never include implementation trivia the commit hash already captures ("changed 3 files", "added 42 lines"). Instead, state the user-visible or contract-level effect.
9. Check length and wrap. Return the final message in a single fenced block so the user can paste it directly.

## Examples

### Happy path: feature with a scope and a why

Diff: new `/v1/invoices/:id/pdf` endpoint that renders with a background worker and streams the result.

```
feat(invoices): stream rendered PDFs from a background worker

The previous implementation rendered synchronously on the request path,
which starved the HTTP thread pool whenever a large invoice came in
(>200 ms at p95, >5 s at p99). Moving rendering to the existing
BullMQ worker and streaming the signed S3 URL keeps the request path
under 50 ms regardless of invoice size.

The worker uses the same wkhtmltopdf container as the nightly report
job, so no new infrastructure is introduced. Rendering errors surface
as a 502 with a problem+json body (see api-standards).

Refs: #4821
```

### Edge case: breaking change

Diff: renames the `name` field on the public `User` JSON to `display_name`, with a one-release deprecation window.

```
feat(api)!: rename User.name to User.display_name

Clients consistently conflated `name` (display) with `legal_name`
(KYC). Renaming aligns the API with the internal vocabulary and
with the mobile SDK's existing field.

A compatibility shim emits both keys for clients on API version
<= 2026-03-01 (see versioning middleware). The old key will be
removed on 2026-07-01.

BREAKING CHANGE: Consumers reading `user.name` must switch to
`user.display_name`. The compatibility shim is active through
the 2026-03-01 version; clients pinned to later versions will
see only `display_name`.

Closes: #5120
```

### Edge case: small fix, no body needed

```
fix(auth): reject password reset tokens after first use

Closes: #4902
```

### Edge case: revert

```
revert: "feat(invoices): stream rendered PDFs from a background worker"

This reverts commit 9f3c1a2b. The worker leaked file handles under
the new load; reverting while the leak is investigated.

Refs: INC-2041
```

## Constraints

- Never start the subject with a capital letter after the type prefix (Conventional Commits convention).
- Never end the subject with a period.
- Never exceed 72 characters in the subject.
- Never mix two logical changes in one commit. If the diff contains, say, a refactor plus a fix, ask to split.
- Never invent issue numbers or co-authors.
- Do not include a stacktrace or log output in the commit message; link to the issue.
- Do not include `BREAKING CHANGE` as a placeholder when nothing is breaking.
- Do not include emojis unless the repo's history already uses them (check with `git log`).

## Quality checks

- Subject parses as `<type>(<scope>)?!?: <imperative>` and is <= 72 chars.
- Type is one of the allowed set and matches the diff's intent.
- `!` in the subject iff a `BREAKING CHANGE:` footer is present.
- Body (if any) is separated by one blank line and wrapped at 72 columns.
- Issue references use the repo's convention (`Refs:` vs `#` vs `Closes:`).
- Running `git log --oneline -n 5` after commit shows a message that reads like the rest of the history.
