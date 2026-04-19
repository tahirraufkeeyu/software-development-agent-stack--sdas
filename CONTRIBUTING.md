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
