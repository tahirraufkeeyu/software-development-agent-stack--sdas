# Software Development Agent Stack (SDAS)

This repository is a curated collection of department-specific Claude Code skills. Skills are organized by department under `departments/<dept>/skills/<skill-name>/SKILL.md`.

## Working in this repo

- Every skill follows the SKILL.md convention with YAML frontmatter (`name`, `description`).
- The `description` field is the trigger signal — keep it specific and written in the form "Use when ...".
- Skills must be self-contained: instructions, examples, constraints, and quality checks in a single file. Long reference material goes in `references/` beside the skill.
- Scripts live in `scripts/` beside the skill and must be idempotent, POSIX-shell compatible where possible, and well-commented.

## When adding a new skill

1. Follow the template in `CONTRIBUTING.md`.
2. Ensure the description begins with "Use when …" so Claude can auto-trigger it.
3. Include at least 2 concrete examples covering both the happy path and an edge case.
4. List required MCP servers / CLI tools explicitly.
5. Update the department README to include the new skill in the index table.

## Style

- Markdown: prefer short paragraphs, numbered lists for procedures, tables for matrices.
- No emojis in skill content unless the skill is specifically about content/marketing tone.
- File references use Markdown links with relative paths so they render in GitHub.
