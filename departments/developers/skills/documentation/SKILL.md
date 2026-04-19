---
name: documentation
description: Use when the user asks for a README, API docs, an ADR, a changelog, a runbook, or any structured technical write-up. Generates the requested artifact from the codebase and git history, following widely-adopted conventions (Keep a Changelog, MADR ADRs, OpenAPI-driven API docs).
---

## When to use

- "Write a README for this repo."
- "Generate API docs from the OpenAPI spec" or "from these route files".
- "Write an ADR for choosing Kafka over SQS."
- "Produce a CHANGELOG entry for v1.4.0."
- "Document this module / this CLI command."

Do not use this skill for marketing copy, blog posts, or long-form narrative — those are outside its scope.

## Inputs

The artifact type — one of:

- `readme`
- `api-docs`
- `adr`
- `changelog`
- `module-doc`
- `runbook`

Plus inputs specific to the type (see Procedure).

## Outputs

Markdown files placed at the repo's conventional location:

- `README.md` at repo root.
- `docs/adr/NNNN-title.md` for ADRs (sequential zero-padded number).
- `CHANGELOG.md` at repo root (Keep a Changelog format).
- `docs/api/` for API reference.
- `docs/runbooks/<service>.md` for runbooks.
- `docs/modules/<name>.md` for module-level docs.

## Tool dependencies

- Read, Grep, Glob for codebase inspection.
- Bash for `git log`, `git tag`, `git diff`.
- Optional: `openapi-cli` / `redocly` to render OpenAPI.

## Procedure

### README

1. Detect the project shape: languages (by file extensions), build tool (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`), entry points, Dockerfile, CI config.
2. Extract the one-sentence purpose from the existing top of `README.md` if present, from `description` in the manifest, or from a repo description. If none, ask the user.
3. Draft sections in this order:
   - Title + one-sentence description.
   - Status badges (CI, coverage, license, latest release) — only ones that actually exist.
   - Quickstart: the three commands that take a new developer from clone to "it runs" (install, build/test, run). Verify commands by inspecting scripts; do not invent.
   - Usage: the two or three most common invocations with real examples.
   - Configuration: table of env vars with purpose, default, required-ness (read from `.env.example`, config schema, or source).
   - Development: test command, lint command, format command, pre-commit setup.
   - Deployment: link to runbook or pipeline if present.
   - Contributing: link to `CONTRIBUTING.md` if present; otherwise a short block (branch naming, commit style, PR review expectations).
   - License: one line, name and link.
4. Keep the README under ~200 lines. Push depth to `docs/`.

### API docs

1. If an OpenAPI / GraphQL SDL file exists, use it as the source of truth. Render a Markdown reference grouped by resource; include request/response examples drawn from the spec's `examples`.
2. Otherwise, walk route definitions (`express.Router`, `FastAPI @app.get`, `go-chi mux.Get`, `axum Router::new().route`) and extract method, path, summary (from docstring/handler comment), auth scope, and reference schemas.
3. For each endpoint: path, method, description, auth, path params, query params, request body schema, response schemas per status code, example request, example response.
4. Include a top-level section on auth (how to obtain a token), error envelope, pagination, versioning, rate limits — link to `api-standards.md` for the underlying conventions.

### ADR (MADR format)

File: `docs/adr/NNNN-short-title.md`.

```
# NNNN. <short title>

- Status: proposed | accepted | deprecated | superseded by ADR-XXXX
- Date: YYYY-MM-DD
- Deciders: <names>

## Context

<What is the problem? What forces are at play? Quantified where possible.>

## Decision

<The change we are making, stated as a single sentence and then elaborated.>

## Alternatives considered

- Option A: <summary, pros, cons, why rejected>
- Option B: <summary, pros, cons, why rejected>
- Option C (chosen): <summary, pros, cons>

## Consequences

### Positive

- ...

### Negative

- ...

### Neutral / follow-ups

- ...

## References

- Links to related tickets, prior ADRs, external research.
```

Infer the next sequential number by reading `docs/adr/`. Start at 0001.

### Changelog (Keep a Changelog)

Maintain `CHANGELOG.md`:

```
# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

## [1.4.0] - 2026-04-19
...
```

Procedure:

1. Read `git log <last-tag>..HEAD --pretty=format:'%h %s'`.
2. Group commits by Conventional Commits type:
   - `feat` -> Added or Changed.
   - `fix` -> Fixed.
   - `perf` -> Changed.
   - `refactor` / `chore` / `docs` / `test` -> omit unless user-visible.
   - `BREAKING CHANGE:` -> Removed or Changed, called out.
3. Rewrite each entry in user-facing terms, not commit terms: "Added bulk export for invoices" not "feat(invoices): bulk export handler".
4. Move `[Unreleased]` into the new version heading with the date; create a new empty `[Unreleased]`.
5. Update the bottom `[version]: <compare URL>` links.

### Module doc

For a single module/package: purpose, public API, example usage, collaborators and dependencies, failure modes, instrumentation (metrics, logs), ownership.

### Runbook

Every on-call runbook has: service name and owners, dashboard links, alert catalogue (each alert -> diagnosis steps -> mitigation), common incidents with step-by-step responses, escalation path, known risks. Avoid including credentials or exact thresholds that will drift — link to the source of truth.

## Examples

### Happy path: README for a Node CLI

Generated section (excerpt):

```markdown
# inv-cli

Command-line client for the Invoices API.

## Quickstart

```bash
pnpm install
pnpm build
pnpm exec inv-cli invoices list --limit 5
```

## Configuration

| Variable | Purpose | Default | Required |
| --- | --- | --- | --- |
| `INV_API_URL` | Base URL of the Invoices API | `https://api.acme.com` | no |
| `INV_API_TOKEN` | Bearer token | — | yes |
| `INV_TIMEOUT_MS` | Per-request timeout | `10000` | no |

## Development

- Test: `pnpm test`
- Lint: `pnpm lint`
- Format: `pnpm format`

## License

MIT. See [LICENSE](LICENSE).
```

### Edge case: ADR for picking Kafka vs SQS

File `docs/adr/0007-choose-kafka-over-sqs.md`:

```markdown
# 0007. Choose Kafka over SQS for the invoice-events bus

- Status: accepted
- Date: 2026-04-19
- Deciders: platform team (Alex, Priya, Marco)

## Context

Invoice events drive billing, notification, and downstream analytics. The
current load is 2k events/s with peaks at 12k/s during end-of-month runs.
We need: (1) replay for the last 7 days, (2) per-customer ordering,
(3) at-least-once delivery, (4) consumer groups to fan out to 4 services.

## Decision

Use Kafka (MSK) as the event backbone. Partition by `customer_id`. Retention
7 days. Consumer groups per service.

## Alternatives considered

- Option A: SQS with FIFO queues. Pro: low ops. Con: per-group throughput cap
  (300 msg/s) insufficient for our largest customer; no replay.
- Option B: Kinesis. Pro: AWS-native, replay. Con: higher per-shard cost at
  our rates; weaker ecosystem of tooling (schema registry, ksqlDB).
- Option C (chosen): Kafka on MSK. Pro: partitioning, replay, ecosystem.
  Con: operational overhead of consumer-group lag monitoring and rebalance
  tuning.

## Consequences

### Positive
- Replay for debugging and backfills.
- Headroom to 100k msg/s without redesign.

### Negative
- On-call burden: consumer lag alerts, rebalance storms.
- Schema registry adds a deployment dependency.

### Neutral / follow-ups
- Write a runbook for consumer-lag triage (#4821).
- Evaluate tiered storage after 3 months.

## References

- Load test report: docs/loadtest/2026-03.md
- Ticket: PLAT-742
```

## Constraints

- Never invent commands. Verify every `pnpm`/`make`/`go`/`python` invocation against the repo.
- Never fabricate env vars, endpoints, or config keys. Trace them back to source.
- Never include secrets, tokens, internal URLs, or customer names in public docs.
- Do not write marketing language ("blazing fast", "best-in-class"). State what the software does.
- Do not claim test coverage numbers, SLA targets, or compliance certifications unless the user provides them.
- Do not generate an ADR for a reversible trivial decision. ADRs are for decisions that are costly to reverse.

## Quality checks

- Every command in the README runs from a clean clone (mentally walk through it).
- Every env var in the config table is referenced in the code.
- ADR sections (Context, Decision, Alternatives, Consequences) are all present and each has real content.
- CHANGELOG entries are user-facing, not commit-message-shaped.
- Links are relative for in-repo references; absolute for external.
- No emojis, no decorative headings, no sentences that could be deleted without losing information.
