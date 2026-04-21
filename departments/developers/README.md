# Developers Department

Software engineering teams spend most of their cognitive budget on a handful of recurring activities: reviewing diffs, writing tests, refactoring, debugging, designing APIs, writing commit messages, documenting systems, and bootstrapping projects. The skills in this department encode the judgment and checklists that senior engineers already apply informally so that Claude Code can apply them consistently across every repo it touches. Adopt these skills to shorten PR cycles, reduce regressions, keep commit history legible, and give newcomers a reliable default path for producing high-quality changes.

## Skills

| Skill | Description | Complexity |
| --- | --- | --- |
| [code-review](skills/code-review/SKILL.md) | Structured review of a diff or PR: security (SQLi, XSS, authz), performance (N+1, unbounded loops), correctness, style. | Medium |
| [test-writer](skills/test-writer/SKILL.md) | Infer existing test conventions from the repo, then generate AAA-style tests for a target file or function. | Medium |
| [refactor](skills/refactor/SKILL.md) | Small-step Fowler-style refactoring with test verification between every change. | High |
| [commit-message](skills/commit-message/SKILL.md) | Write Conventional Commits subject/body/footer from a staged diff. | Low |
| [debug](skills/debug/SKILL.md) | Reproduce, isolate (bisect), hypothesize, verify, fix, and add a regression test. | High |
| [api-design](skills/api-design/SKILL.md) | Design REST or GraphQL endpoints and emit an OpenAPI 3.1 spec fragment. | High |
| [documentation](skills/documentation/SKILL.md) | Generate README, API docs, ADR, or changelog from code and git history. | Medium |
| [project-bootstrap](skills/project-bootstrap/SKILL.md) | Scaffold a new TypeScript, Python, Go, or Rust project with linting, formatter, CI, and license. | Medium |

## Workflow orchestrator

This department ships one **workflow orchestrator** skill that chains the task skills above into an end-to-end flow. Orchestrators have a richer frontmatter (`chains`, `produces`, `consumes`) and are invoked the same way as any other skill.

| Orchestrator | Chains | One-line purpose |
| --- | --- | --- |
| [ship-feature](skills/ship-feature/SKILL.md) | test-writer, code-review, commit-message | Pre-commit gate: generate tests, review the diff, draft the commit message — with a halt on high-severity review findings. |

## Quick install

```bash
skillskit install developers
```

This copies every skill in this department into `~/.claude/skills/` and makes them available to Claude Code.

Don't have the CLI yet? Install it with `brew install tahirraufkeeyu/tap/skillskit` (macOS/Linux) or `scoop install tahirraufkeeyu/scoop-bucket/skillskit` (Windows). See [skillskit.dev](https://skillskit.dev/#install) for alternative installers.

## Recommended MCP servers

- [GitHub MCP](https://github.com/github/github-mcp-server): fetch PRs, diffs, issues, and file contents without leaving the chat. Required for `code-review` when pointed at a PR URL.
- [Filesystem MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem): sandboxed reads/writes for `refactor`, `test-writer`, `project-bootstrap`.
- [Context7](https://github.com/upstash/context7): pull current, version-pinned library docs on demand. Use with `api-design` and `project-bootstrap` to avoid stale API suggestions.

## Recommended workflows

Bugfix flow:

```
debug  ->  code-review  ->  test-writer  ->  commit-message
```

Reproduce and fix with `debug`, self-review the patch with `code-review`, add a regression test with `test-writer`, and write the commit with `commit-message`.

Greenfield feature flow:

```
project-bootstrap  ->  api-design  ->  test-writer  ->  documentation  ->  commit-message
```

Legacy cleanup flow:

```
test-writer (characterisation tests)  ->  refactor  ->  code-review  ->  commit-message
```

Release flow:

```
documentation (changelog)  ->  commit-message  ->  code-review
```
