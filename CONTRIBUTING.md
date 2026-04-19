# Contributing to Software Development Agent Stack (SDAS)

Thanks for considering a contribution. This kit aims to be the highest-signal collection of department-specific Claude Code skills — every new skill should encode real-world practice from practitioners doing the work.

## What makes a good skill

A good skill:

1. **Solves one coherent problem.** If you're describing two unrelated things, split them.
2. **Is triggered predictably.** The `description` field should start with "Use when …" and be specific enough that Claude knows exactly when to invoke it.
3. **Encodes expertise, not instructions.** "Run pytest" is a command. A skill captures *when to run it*, *how to interpret failures*, *what patterns to produce*, and *what to avoid*.
4. **Is tool-aware.** List the MCP servers and CLI tools the skill depends on.
5. **Provides output consistency.** Two different runs on similar inputs should produce similar-quality output.

## Skill template

Create a new skill at `departments/<dept>/skills/<skill-name>/SKILL.md`:

```markdown
---
name: skill-name
description: Use when <specific trigger>. <What the skill does in one sentence>.
# Optional artifact fields — fill in when the skill reads or writes a
# named artifact another skill in this kit also knows about. See the
# "Artifacts and chaining" section below.
produces: path/to/output.ext
consumes:
  - path/to/input-a.ext
  - path/to/input-b.ext
chains:
  - other-skill-name
---

# <Human-readable title>

## When to use
- <trigger 1>
- <trigger 2>

## Inputs
- <what the skill expects>

## Outputs
- <what the skill produces>

## Tool dependencies
- <CLI or MCP server>

## Procedure
1. <step>
2. <step>

## Examples

### Example 1: <happy path>
...

### Example 2: <edge case>
...

## Constraints
- <what NOT to do>

## Quality checks
- <how to verify the output>
```

### Artifacts and chaining

Most skills in this kit stand alone. But a few — especially the *workflow orchestrators* under each department — call a sequence of other skills and pass data between them. Three optional frontmatter fields let this composition be machine-readable:

| Field | Type | Meaning |
|---|---|---|
| `produces` | single path | The primary artifact the skill writes. Relative to the project root. Example: `security/findings/secrets.json`. |
| `consumes` | list of paths | Artifacts the skill expects to already exist. An orchestrator reads these to verify the upstream skill ran. |
| `chains` | list of skill names | Skill names this skill invokes in order. Mostly used by workflow orchestrators. |

Conventions for artifact paths:

- **Root-relative** — use `security/findings/secrets.json`, not `~/security/findings/secrets.json` or absolute paths.
- **Stable names** — the filename encodes what it is, not when it ran. Timestamps go in the file content, not the path.
- **Per-department folder** — `security/`, `qa/`, `devops/` etc. Orchestrators assume this layout.
- **Kebab-case filenames** — `pentest-report.md`, not `PentestReport.md`.

When adding a skill that produces an artifact another skill consumes, add the `produces:` field even if no orchestrator yet chains it. Future orchestrators pick it up automatically.

For orchestrators (`chains:` is set), the body of `SKILL.md` should include a `## Chained skills` section enumerating the skills it calls and the order. This keeps the human-readable version in sync with the machine-readable list.

## Reference material

Long reference content (checklists, templates, tables of patterns) goes in a `references/` directory beside the skill:

```
skills/my-skill/
├── SKILL.md
└── references/
    └── checklist.md
```

Point to references from SKILL.md with relative links: `see [checklist](references/checklist.md)`.

## Scripts

Executable scripts go in `scripts/` beside the skill. Scripts must:

- Start with a shebang (`#!/usr/bin/env bash` for shell, `#!/usr/bin/env python3` for Python).
- Use `set -euo pipefail` for shell scripts.
- Include a usage comment at the top.
- Be idempotent where possible.
- Not require root or make global system changes without asking.

## Adding a new department

1. Create `departments/<dept>/README.md` following the existing department READMEs as a template.
2. Add at least 4 skills.
3. Update the root [README.md](README.md) department index.

## Submitting

1. Fork the repo.
2. Create a feature branch: `git checkout -b skill/<dept>-<skill-name>`.
3. Add your skill, update the department README, update stats in the root README.
4. Open a PR with:
   - A one-line summary of what the skill does.
   - Which department it belongs to and why.
   - A note on who tested it and in what environment.

## Style guide

- No emojis in skill content (the skill is a tool, not a personality).
- Headings: use `## Section` not `**Section**`.
- Bullet lists for unordered items, numbered lists for sequences.
- Link to files using relative Markdown paths so they work on GitHub.
- Keep SKILL.md under ~400 lines — push deep detail into references.

## Code of Conduct

Be respectful. Assume good faith. Critique the skill, not the contributor.
