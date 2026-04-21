# Simple 101 — setup + your first skill

**What this shows:** how to get SDAS working in four different AI tools (Claude Code, Claude Code in VS Code, GitHub Copilot, Codex CLI), then use one skill to build a tiny API endpoint. End-to-end time: ~15 minutes.

**Who this is for:** someone who has never used a Claude Code skill library before. If you already know the install flow, skip to the [tiny API example](#part-2--tiny-api-example).

**What you won't find here:** the full feature-delivery flow (that's in [../developers/how-to.md](../developers/how-to.md)). This example stops at "one endpoint working, one skill exercised, you're set up."

---

## Part 1 — setup (pick one tool)

The kit is plain Markdown, so it works with any AI tool that can read local files. Claude Code is the best fit because it auto-discovers skills from `~/.claude/skills/` without configuration. The others need either an extension (VS Code) or some copy-paste.

Pick whichever you already use or want to try:

- [Option A — Claude Code (recommended)](#option-a--claude-code-recommended)
- [Option B — Claude Code inside VS Code](#option-b--claude-code-inside-vs-code)
- [Option C — GitHub Copilot (for comparison)](#option-c--github-copilot-for-comparison)
- [Option D — Codex CLI](#option-d--codex-cli)

### Option A — Claude Code (recommended)

This is the smoothest path because Claude Code auto-loads every `SKILL.md` in `~/.claude/skills/` on startup.

#### Install Claude Code

Go to [claude.com/code](https://claude.com/code) or run:

```bash
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
iwr https://claude.ai/install.ps1 -useb | iex
```

Sign in once:

```bash
claude
```

#### Install the SDAS skills

```bash
git clone https://github.com/tahirraufkeeyu/software-development-agent-stack--sdas.git ~/sdas
cd ~/sdas
./install.sh all
```

The installer copies every skill into `~/.claude/skills/`. You'll see it list each folder as it copies. Done — Claude Code will pick them up next time it starts.

#### Verify it works

```bash
cd /tmp && mkdir claude-test && cd claude-test
claude
```

In the chat, type:

> "What SDAS skills do you have installed?"

Claude should list skills grouped by department. If it can't see them:

1. Check the folder exists: `ls ~/.claude/skills/` — should show ~64 folders.
2. Restart Claude Code (`Ctrl+C`, then `claude` again).
3. Re-run `~/sdas/install.sh --update` to resync.

**You're done with setup.** Jump to the [tiny API example](#part-2--tiny-api-example).

---

### Option B — Claude Code inside VS Code

Claude Code ships a VS Code extension that runs the same Claude Code in a side panel. Skills you installed via Option A are already visible — no extra step.

#### Install

1. Open VS Code → Extensions (Cmd/Ctrl+Shift+X).
2. Search for "Claude Code" → install the official Anthropic extension.
3. Sign in via the extension prompt (reuses your `claude` CLI session if you ran Option A).

#### Install the skills (if you haven't already)

Same as Option A — the skills live in `~/.claude/skills/` regardless of how Claude Code is invoked:

```bash
git clone https://github.com/tahirraufkeeyu/software-development-agent-stack--sdas.git ~/sdas
cd ~/sdas && ./install.sh all
```

#### Verify

Open any project in VS Code. Open the Claude Code side panel (Cmd/Ctrl+Shift+P → "Claude Code: Open"). Type:

> "What SDAS skills do you have installed?"

Same list as Option A. You can now invoke skills directly from the editor without leaving VS Code.

**You're done.** Jump to the [tiny API example](#part-2--tiny-api-example).

---

### Option C — GitHub Copilot (for comparison)

GitHub Copilot doesn't have a formal skills directory like Claude Code does, but it can read files you reference with `@file` or `@workspace`. You can still use the SDAS skill content — you just have to reference the specific SKILL.md file when you need it.

Verdict up front: **this works, but it's friction.** Claude Code auto-triggers the right skill from your natural-language request. Copilot requires you to name the file. If SDAS is your main driver, use Claude Code. If you're already in Copilot and want to leverage SDAS occasionally, this is how.

#### Install

Copilot is a VS Code extension installed from the Marketplace. If you already have it, skip.

#### Copy the skills somewhere Copilot can see them

The installer has a `--host` flag for project-local installs:

```bash
cd ~/your-project
~/sdas/install.sh all --host cursor
# writes to ./.cursor/rules/ — Copilot can read these with @file
```

Alternatively, just clone the SDAS repo into a sibling folder and reference files from there.

#### Use a skill

In the Copilot chat:

> `@file:~/.cursor/rules/code-review/SKILL.md` Review the changes in my latest commit using this skill.

Copilot reads the SKILL.md as context and follows the procedure. You lose auto-triggering (you have to name the file), but you keep the skill's structure.

---

### Option D — Codex CLI

[Codex CLI](https://github.com/openai/codex) is OpenAI's command-line coding agent. It reads an `AGENTS.md` at the project root and a `~/.codex/` global config. Skills can be dropped in either location.

#### Install Codex CLI

```bash
npm install -g @openai/codex
codex login
```

#### Install the skills

```bash
~/sdas/install.sh all --host codex
# writes to ./.codex/skills/ — project-local
```

You'll also need to reference them from an `AGENTS.md`. Create one at the project root:

```markdown
# Agents

Skills for this project are under `.codex/skills/`. When the user asks
for a task matching a skill's `description` field, follow that skill's
`Procedure` section.
```

Codex reads `AGENTS.md` on each invocation and resolves the skill references from there.

**You're done.** Continue to the tiny API example.

---

## Part 2 — tiny API example

Goal: create a single `GET /hello` endpoint in a Python FastAPI project, using the `project-bootstrap` skill. End-to-end: 10 minutes.

This example assumes Option A or B (Claude Code). Adapt the prompts if you're on C or D.

### Step 0 — make an empty directory

```bash
cd ~/src
mkdir hello-api && cd hello-api
claude
```

You're now in Claude Code, in an empty directory.

### Step 1 — ask Claude to scaffold the project

**User asks:**

> "Bootstrap a Python FastAPI project here. Include a single GET /hello endpoint that returns {\"message\": \"hello\"}. Add pytest and ruff. Keep it minimal."

**Skill matched:** `project-bootstrap`
Trigger: description is *"Scaffold a new TypeScript, Python, Go, or Rust project with linting, formatter, CI, and license."*

**What Claude did:**

1. Asked whether to use `poetry` or `uv` for dependency management (you answered: `uv`).
2. Generated the minimal project tree:

    ```
    hello-api/
    ├── pyproject.toml
    ├── README.md
    ├── .gitignore
    ├── .ruff.toml
    ├── src/
    │   └── hello_api/
    │       ├── __init__.py
    │       └── main.py
    └── tests/
        └── test_main.py
    ```

3. Wrote a minimal `main.py`:

    ```python
    # src/hello_api/main.py
    from fastapi import FastAPI

    app = FastAPI()

    @app.get("/hello")
    def hello() -> dict[str, str]:
        return {"message": "hello"}
    ```

4. Wrote one pytest:

    ```python
    # tests/test_main.py
    from fastapi.testclient import TestClient
    from hello_api.main import app

    client = TestClient(app)

    def test_hello() -> None:
        r = client.get("/hello")
        assert r.status_code == 200
        assert r.json() == {"message": "hello"}
    ```

5. Showed you the commands to run it.

### Step 2 — run it

```bash
uv sync                     # install deps into .venv
uv run uvicorn hello_api.main:app --reload
```

Hit `http://localhost:8000/hello` in a browser or:

```bash
curl http://localhost:8000/hello
# {"message":"hello"}
```

Run the test:

```bash
uv run pytest
# tests/test_main.py .                                              [100%]
# ============================== 1 passed in 0.12s ==============================
```

### Step 3 — that's it

You installed SDAS, triggered one skill, and shipped a working endpoint. Everything after this is the same pattern: ask Claude for a task, Claude matches it to a skill, the skill's `Procedure` runs.

---

## What to do next

- **Run the full end-to-end walkthrough** — [../developers/how-to.md](../developers/how-to.md) shows 9 skills on a real public repo over ~45 minutes.
- **Explore one department** — open a department README and pick a skill that solves a task you already do weekly:
  - [developers](../../departments/developers/README.md) — code review, tests, refactor, debug
  - [security](../../departments/security/README.md) — audit, remediation, compliance
  - [devops](../../departments/devops/README.md) — deploy, pipelines, IaC
  - [qa](../../departments/qa/README.md) — E2E tests, performance, accessibility
  - [sales](../../departments/sales/README.md), [marketing](../../departments/marketing/README.md), [internal-comms](../../departments/internal-comms/README.md)
- **Customise a skill** — open `~/.claude/skills/<some-skill>/SKILL.md` in any editor. Change the `description` to match your team's vocabulary, tighten the `Constraints`, add your own examples. The kit is meant to be edited.

---

## Troubleshooting setup

**"Claude can't find my skills."**
- `ls ~/.claude/skills/` — should show ~64 folders.
- If empty, re-run `~/sdas/install.sh all`.
- If populated but Claude still doesn't see them, restart Claude Code.

**"install.sh says command not found."**
- You need to be in the SDAS repo: `cd ~/sdas && ./install.sh all`.
- Make sure it's executable: `chmod +x install.sh`.

**"I'm on Windows and the install script won't run."**
- Install [Git Bash](https://git-scm.com/download/win) or use WSL.
- Alternatively, copy the `departments/*/skills/*/` folders manually into `%USERPROFILE%\.claude\skills\`.

**"Claude Code invoked the wrong skill."**
- Be more specific in your prompt — reference the skill by name: *"Use the `project-bootstrap` skill to scaffold a FastAPI project."*
- If you keep hitting the same wrong skill, the description of the intended skill may need tightening. Edit it and restart Claude Code.

**"I want to uninstall."**
- `rm -rf ~/.claude/skills/` — removes all skills. SDAS does not touch anything else on your machine.

---

See [../README.md](../README.md) for the list of examples, or [../../README.md](../../README.md) for the kit overview.
