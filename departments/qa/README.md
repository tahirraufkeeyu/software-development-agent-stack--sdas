# QA Department

Agent-assisted quality engineering skills for modern delivery teams. These skills help QA engineers, SDETs, and full-stack developers generate durable tests, audit user-facing quality signals, and ship fewer regressions per release.

## Why agent-assisted QA

Manual test authoring scales poorly with product surface area. Teams ship faster than they can write Playwright specs, faker fixtures, OpenAPI contract tests, and accessibility audits by hand. These skills turn a specification (a user story, an OpenAPI doc, a URL, a schema) into runnable test code and actionable reports.

Benefits:
- Test code that conforms to in-repo conventions (page object model, data-testid selectors, explicit waits).
- Deterministic, reproducible test data keyed to a seed.
- WCAG 2.1 AA audits grounded in Chrome DevTools accessibility tree, not opinion.
- Core Web Vitals measurements pulled from real Lighthouse runs rather than anecdote.
- Bug reports that enforce reproducibility before filing.

## Skills

| Skill | Description | Complexity |
| --- | --- | --- |
| `e2e-test-generator` | Generate Playwright/Cypress end-to-end tests from a user story using page object model and data-testid selectors. | Medium |
| `api-test-generator` | Generate property-based API tests from OpenAPI 3.x using Schemathesis, REST-assured, or supertest. | Medium |
| `performance-test` | Core Web Vitals and Lighthouse audit via Chrome DevTools MCP with prioritized fix suggestions. | High |
| `accessibility-audit` | WCAG 2.1 AA audit via Chrome DevTools accessibility tree and axe-core. | High |
| `test-data-generator` | Generate realistic, seeded test data from JSON Schema or DB schema as SQL/JSON/CSV. | Low |
| `bug-report` | Produce a structured, reproducible bug report with enforced fields. | Low |

## Workflow orchestrator

This department ships one **workflow orchestrator** skill that chains the task skills above into an end-to-end flow. Orchestrators have a richer frontmatter (`chains`, `produces`, `consumes`) and are invoked the same way as any other skill.

| Orchestrator | Chains | One-line purpose |
| --- | --- | --- |
| [full-regression](skills/full-regression/SKILL.md) | test-data-generator, api-test-generator, e2e-test-generator, performance-test, accessibility-audit, bug-report | Pre-release QA sweep across API, E2E, performance, and accessibility with go/no-go recommendation. |

## Quick install

```bash
./install.sh qa
```

This copies the `qa` department's skills into `.claude/skills/` in the current repository. Re-run the script to refresh.

## Recommended MCP servers

Install these in your Claude Code configuration (`~/.claude/settings.json` or project `.claude/settings.json`):

- **Chrome DevTools MCP** (required for `performance-test` and `accessibility-audit`): exposes `mcp__chrome-devtools__lighthouse_audit`, `mcp__chrome-devtools__performance_start_trace`, `mcp__chrome-devtools__take_snapshot`, `mcp__chrome-devtools__evaluate_script`. Install: `npx @modelcontextprotocol/server-chrome-devtools`.
- **Playwright MCP** (optional, used by `e2e-test-generator`): lets the agent run generated specs and iterate on selector failures.
- **Filesystem MCP** (optional but recommended): needed for the agent to write generated tests into the target repository without losing scope.

Example `settings.json` fragment:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-chrome-devtools"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

## Recommended release-cycle workflow

Run these skills in order as release candidates move from "feature complete" to "shippable":

1. **`test-data-generator`** — Produce seeded fixtures for staging DB and test runtime. Output: `tests/fixtures/*.json` plus a SQL seed.
2. **`api-test-generator`** — Regenerate Schemathesis / supertest suites from the latest OpenAPI spec. Fail the build on contract drift.
3. **`e2e-test-generator`** — For each new user story on the release board, emit a Playwright spec under `tests/e2e/`. Wire into CI with sharding.
4. **`performance-test`** — Run a Lighthouse + CWV trace against the release candidate URL. Block release on LCP > 4s, CLS > 0.25, or INP > 500ms.
5. **`accessibility-audit`** — axe-core + DevTools pass on every critical-path page. Block release on any serious/critical WCAG 2.1 AA violation.

`bug-report` is invoked out-of-band whenever a human or another skill observes a defect; it is not cycle-gated.

## Conventions assumed by these skills

- Selectors: `data-testid="..."` attributes. The e2e skill refuses to emit CSS-class or XPath-only selectors.
- Waits: `expect(locator).toBeVisible()` / `page.waitForResponse(...)`. No `waitForTimeout`, no `sleep`.
- Assertions: web-first assertions with auto-retry (Playwright `expect`, Cypress `should`).
- Test data: seeded via `faker.seed(<int>)` or equivalent so runs are reproducible.
- Accessibility: inline axe assertions inside e2e specs for critical flows; full-page audit via the dedicated skill.
