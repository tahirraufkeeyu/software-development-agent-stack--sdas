## What this changes

<!-- One or two sentences. What does this PR do? -->

## Why

<!-- The problem or motivation. Link the issue if there is one: "Fixes #123" -->

## Scope

<!-- Tick the box that applies — helps reviewers know what to look for. -->

- [ ] CLI / release infrastructure (Go code, GoReleaser, install scripts)
- [ ] New or rewritten skill (`departments/<dept>/skills/<skill>/`)
- [ ] Existing skill content edit (clarification, command fix, reference update)
- [ ] Site (`site/`)
- [ ] Repo docs / templates / governance
- [ ] Other (explain)

## Checklist

- [ ] If a skill changed: the `description` still begins with "Use when …" and is specific enough for auto-trigger.
- [ ] If a skill changed: the department `README.md` skill table still lists it correctly.
- [ ] If commands or flags changed: I ran the changed command on at least one platform.
- [ ] If site copy changed: I checked it renders (`pnpm dev` in `site/`).
- [ ] If Go code changed: `go build ./...` and `go vet ./...` pass.
- [ ] No personal info, customer data, or hard-coded credentials in the diff.
- [ ] No real domains used as fake examples (use `*.example` or `example.com`).

## Test notes

<!-- For reviewers: paste the output of the manual test you ran, or describe how you verified the change. -->
