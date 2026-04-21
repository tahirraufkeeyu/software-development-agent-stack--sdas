# Examples

Worked, end-to-end examples of the kit in action. Each folder is a self-contained walkthrough: user prompts, which skill Claude matched, the exact actions Claude took, files changed, and the final result.

These are the best starting point if you want to *see* the kit before reading the full SKILL.md files.

## Available examples

| Folder | What it shows | Level | Time to read | Time to run |
|---|---|---|---|---|
| [simple-101/](simple-101/how-to.md) | Setup for Claude Code, the VS Code extension, GitHub Copilot (for comparison), and Codex CLI. Then a tiny "hello world" API using one skill. | Beginner | 5 min | 15 min |
| [developers/](developers/how-to.md) | Full end-to-end flow on a real public repo: understand code → design API → implement → debug → test → review → commit → ship → document. Exercises 9 skills including the `ship-feature` orchestrator. | Intermediate | 15 min | 45 min |

## How to use these

1. **Read first.** Every example is written so you can follow the flow by reading alone — you don't have to run it.
2. **Or clone and try.** Each example lists the target repo (public GitHub URL) and the exact commands. If you want hands-on, you can literally reproduce the walkthrough.
3. **Or adapt.** Use the example as a template for your own repo. The skill invocation patterns (how to phrase prompts, how to chain skills) translate directly.

## Format of each `how-to.md`

Every walkthrough uses the same format so you know what to expect:

```
### Step N — <what the user is trying to accomplish>

User asks:     "<the prompt the user typed>"

Skill matched: `<skill-name>` (auto-triggered by description match)

What Claude did:
  1. Ran <commands> to understand context
  2. Read <files>
  3. Produced <output>
  4. <other actions>

Files changed:
  - path/to/file.ts (+10 / -2)

Output (excerpt):
  <short excerpt of what Claude produced>

Why this skill: <one-line explanation of why Claude chose this skill
                over any other, and what was decisive>
```

This format makes it easy to scan for "when does skill X trigger" and "what does skill X actually produce."

## Simulating vs running

The `developers/` example targets a real public repo, so you can literally clone it and follow every step. The prompts and commands are copy-paste ready.

Some outputs (test results, PR descriptions, build logs) are shown as representative excerpts rather than full dumps — real runs produce similar but not identical output depending on your environment.

The `simple-101/` example is also runnable end-to-end. It's shorter because the goal is a working setup, not feature delivery.

## Contributing new examples

If you run the kit on a real project and think the flow would help someone else, open a PR adding a new folder under `examples/`. Follow the same `how-to.md` format. Target repos should be public and popular enough that readers recognise them.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the skill template and style rules.
