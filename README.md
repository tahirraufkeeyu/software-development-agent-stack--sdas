# agent-skills-starter-kit

**A ready-made library of 50 "skills" that teach Claude how to do real work for your team — code review, security audits, sales research, weekly status updates, and more.**

You don't need to be an AI expert to use this. If you can copy and paste a command, you can install it. If you can send a message in a chat app, you can use the skills.

---

## Table of contents

1. [What is this?](#what-is-this)
2. [What is a "skill"?](#what-is-a-skill)
3. [Who is this for?](#who-is-this-for)
4. [What you need before you start](#what-you-need-before-you-start)
5. [Install in 2 minutes](#install-in-2-minutes)
6. [What install.sh actually does](#what-installsh-actually-does)
7. [How to use a skill](#how-to-use-a-skill)
8. [The 8 departments and 50 skills](#the-8-departments-and-50-skills)
9. [Customising skills for your team](#customising-skills-for-your-team)
10. [Works with Cursor, Gemini CLI, Codex CLI too](#works-with-cursor-gemini-cli-codex-cli-too)
11. [FAQ](#faq)
12. [Contributing](#contributing)
13. [License](#license)

---

## What is this?

This is a folder of text files that teach Claude (Anthropic's AI assistant) how to do specific tasks the way your team would want them done.

For example, you can install the **code-review** skill, then say to Claude "review this pull request" — and instead of giving you a generic AI answer, Claude will follow a structured checklist (security issues, performance problems, style issues, test gaps) and give you a review that looks like one a senior engineer would write.

We've written **50 of these skills** across 8 departments:

- 👩‍💻 **Developers** — review code, write tests, refactor safely, generate commit messages, debug, design APIs, write docs, bootstrap new projects
- 🔒 **Security** — run audits, scan for leaked secrets, check dependencies for known vulnerabilities, write pentest reports, scan containers, check SOC2 compliance
- 🚀 **DevOps** — deploy with canaries, generate CI/CD pipelines, write Terraform, build Helm charts, respond to incidents, find cloud cost waste
- 🛠 **Infrastructure** — set up Prometheus/Grafana, aggregate logs, manage SSL certs, diagnose network issues, design backups, check cluster health
- ✅ **QA** — generate Playwright/Cypress tests, audit API specs, measure Core Web Vitals, check WCAG accessibility, create test data, file bug reports
- 💼 **Sales** — research leads, analyse competitors, write proposals, draft outreach sequences, respond to RFPs, prep for meetings
- 📣 **Marketing** — write blog posts, draft social media, optimise for SEO, build email campaigns, monitor competitors, produce weekly analytics
- 📨 **Internal comms** — write weekly status updates, incident postmortems, meeting notes, changelogs, onboarding guides, announcements

Every skill is a plain Markdown file you can read, edit, and share.

---

## What is a "skill"?

Think of a skill as a **recipe card** for Claude.

Without a skill, if you ask Claude "review this code," you'll get a generic answer that depends on its mood. With a skill, you've handed Claude a recipe card that says:

> "When someone asks you to review code, do these 7 specific things, in this order, check for these 12 issues, write the output in this format, and don't do these 4 things."

The result is consistent output that matches how your team actually works.

A skill is just one file called `SKILL.md` with these sections:

- **When to use** — what triggers the skill
- **Procedure** — numbered steps Claude should follow
- **Examples** — what good output looks like
- **Constraints** — things Claude should *not* do
- **Quality checks** — how to verify the output is good

That's it. No code, no installation, no magic. Claude reads the file when you ask something that matches.

---

## Who is this for?

- **Engineering teams** who want consistent code reviews, test patterns, and deploy checklists.
- **Security teams** who want audit reports in the same format every time.
- **Sales & marketing teams** who want AI to research, draft, and report using their brand voice.
- **Operations teams** who want Claude to write their status updates, meeting notes, and postmortems.
- **Startup founders** who need one person to do the work of five — with AI doing the heavy drafting.
- **Curious individuals** who've heard about "AI agents" and want a concrete example they can try today.

If you've never written code before, you can still use the non-technical skills (sales, marketing, internal-comms) easily. The technical skills require a terminal and some familiarity with your codebase.

---

## What you need before you start

Just one thing: **Claude Code**.

Claude Code is Anthropic's free command-line tool that connects you to Claude. It's how skills get loaded and used.

### Install Claude Code

Go to [claude.com/code](https://claude.com/code) or run:

```bash
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
iwr https://claude.ai/install.ps1 -useb | iex
```

Then sign in:

```bash
claude
```

That's it. You now have Claude in your terminal. Try typing a question like "what's in this folder?" — Claude will answer.

**Don't have a terminal?** On macOS open "Terminal" (Cmd+Space, type "terminal"). On Windows open "PowerShell" (Start menu, type "powershell"). On Linux you already know.

---

## Install in 2 minutes

Open a terminal and run:

```bash
# 1. Download this repo
git clone https://github.com/<your-org>/agent-skills-starter-kit.git
cd agent-skills-starter-kit

# 2. Install all skills
./install.sh all
```

That's it. The next time you run `claude`, all 50 skills are available.

### Install only some departments

Not everyone needs the security audit skills. Install just what your team uses:

```bash
./install.sh developers       # just developer skills
./install.sh sales            # just sales skills
./install.sh marketing        # just marketing skills
```

### See what's available

```bash
./install.sh --list           # list all departments
./install.sh --dry-run all    # preview without actually installing
./install.sh --help           # show usage
```

### If you don't have `git`

You can also [download the ZIP file](https://github.com/<your-org>/agent-skills-starter-kit/archive/refs/heads/main.zip), unzip it, and then run `./install.sh all` from the unzipped folder.

---

## What install.sh actually does

If you're wondering what the install script is doing to your computer, here's the plain-English version.

**It copies files. That's all.**

Specifically, it takes the skill folders from this repo and copies them into `~/.claude/skills/` — a folder on your computer that Claude Code watches. When you start Claude, it reads every skill in that folder so they're ready to use.

### What it does NOT do

- ❌ Does not run any of the scripts inside the skills (e.g. the security audit scripts stay inert until *you* run them manually).
- ❌ Does not install software, libraries, or dependencies.
- ❌ Does not access the internet.
- ❌ Does not require admin / root / sudo privileges.
- ❌ Does not modify your system configuration.
- ❌ Does not collect data or telemetry.

### What it does step-by-step

1. Finds every skill folder under `departments/<dept>/skills/`.
2. For each one, checks if a skill with the same name already exists in `~/.claude/skills/`.
   - If yes, **asks you** before overwriting (defaults to "no, skip").
   - If no, copies the folder into place.
3. Prints a summary of what was installed and what was skipped.

### If you'd rather do it manually

Skip the script entirely — just copy folders:

```bash
mkdir -p ~/.claude/skills
cp -R departments/developers/skills/* ~/.claude/skills/
```

Same result.

### Install to a different location

```bash
CLAUDE_SKILLS_DIR=/custom/path ./install.sh all
```

Useful if you want to keep skills in a shared folder or sync them via Dropbox.

---

## How to use a skill

After installation, start Claude Code and just ask for what you want in plain English. Claude picks the right skill automatically.

### Example 1 — code review

```
You:      Can you review the changes in my latest commit?

Claude:   [auto-triggers code-review skill]
          I'll review the diff against the structured checklist.

          SECURITY
          - Line 42: user input is concatenated into a SQL query.
            Recommend parameterised query. (High severity)

          PERFORMANCE
          - Line 87: nested loop over all users × all orders. Likely
            N+1 query. Consider a join. (Medium severity)

          STYLE
          - Line 15: function name `doStuff` is vague. Suggest `calculateTax`.

          [... etc]
```

### Example 2 — weekly status update

```
You:      Draft my weekly status update. We shipped the new login page,
          finished most of the mobile redesign, and the billing integration
          is blocked on vendor API access.

Claude:   [auto-triggers status-update skill]

          Week of April 19

          Shipped
          - New login page — 18% faster TTI, replaces legacy flow

          In flight
          - Mobile redesign — 80% done, shipping Friday

          Blocked
          - Billing integration — waiting on vendor API access since Apr 14.
            Ask: need @procurement to escalate.

          [... etc]
```

### Example 3 — competitor research for sales

```
You:      Research Acme Corp for me before our call tomorrow.

Claude:   [auto-triggers lead-research skill]
          [searches web, reads their site, checks news]

          Acme Corp — Company Brief
          - Size: ~500 employees, $80M ARR estimated
          - Stack: AWS, Shopify Plus, Snowflake
          - Recent: Series C in Feb 2026, new CTO hired from Stripe
          - Pain signals: 3 recent G2 reviews mention "slow checkout"

          Outreach angles:
          1. New CTO is reorganising — right moment for new tooling
          2. Checkout speed pain aligns with our value prop
          3. Snowflake users typically struggle with X — our integration helps

          [... etc]
```

### How skill "triggering" works

Each skill has a short description like:

> "Use when someone asks to review code, review a pull request, or check a diff for issues."

Claude reads all these descriptions and matches them against what you're asking. You don't have to remember skill names — just describe what you want. If two skills could fit, Claude will pick the most specific one.

### You can also name a skill directly

```
You:      Use the pentest-report skill to format my scan results into a report.
```

---

## The 8 departments and 50 skills

| Department | Skills | One-line description |
|---|---|---|
| [developers](departments/developers/README.md) | 8 | Code review, tests, refactoring, debug, commits, API design, docs, scaffolding |
| [security](departments/security/README.md) | 6 | Full audit, secret scanning, CVE check, pentest report, container scan, SOC2 |
| [devops](departments/devops/README.md) | 6 | Deploy, CI/CD YAML, Terraform, Helm, incidents, cost optimisation |
| [infrastructure](departments/infrastructure/README.md) | 6 | Monitoring, logs, SSL certs, network, backups, cluster health |
| [qa](departments/qa/README.md) | 6 | E2E tests, API tests, perf, accessibility, test data, bug reports |
| [sales](departments/sales/README.md) | 6 | Lead research, competitive analysis, proposals, outreach, RFPs, meeting prep |
| [marketing](departments/marketing/README.md) | 6 | Content, social, SEO, email, competitor tracking, analytics |
| [internal-comms](departments/internal-comms/README.md) | 6 | Status updates, postmortems, meeting notes, changelogs, onboarding, announcements |

**Click any department above** to see the full skill list, install instructions, and recommended workflows.

---

## Customising skills for your team

Every skill is a plain Markdown file. Edit them freely — this is the whole point.

### Finding a skill after install

After running `./install.sh`, your skills live at `~/.claude/skills/<skill-name>/SKILL.md`.

Open one in any text editor:

```bash
# macOS/Linux
open ~/.claude/skills/code-review/SKILL.md

# or just any editor:
code ~/.claude/skills/code-review/SKILL.md
```

### Common customisations

- **Swap vocabulary** — if your team says "MR" (merge request) not "PR" (pull request), find/replace in the file.
- **Add your coding standards** — drop them in the `references/` folder beside the skill and link from SKILL.md.
- **Change the output format** — if your team uses a specific incident report template, replace the example in the `Examples` section.
- **Tighten when it triggers** — edit the `description:` line at the top. That's what Claude uses to decide whether to invoke the skill.

### Sync customisations with your team

Option A — keep them in a team Git repo and use symlinks:

```bash
# instead of the installer, symlink each skill directory
ln -s /path/to/team-repo/code-review ~/.claude/skills/code-review
```

Option B — fork this repo internally, put your changes in, and have everyone install from the fork.

---

## Works with Cursor, Gemini CLI, Codex CLI too

These skills are written in plain Markdown, so they work with any AI tool that can read a file. Claude Code is the most natural fit (auto-discovery), but:

- **Cursor** — paste a SKILL.md into your `.cursorrules` or drop it into chat with `@file`.
- **Gemini CLI** — point `--system` at the SKILL.md contents.
- **Codex CLI / GitHub Copilot Chat** — copy SKILL.md into the system prompt or repo context.
- **ChatGPT, Grok, any chat app** — copy-paste the skill into the conversation as context.

You don't *have* to use Claude Code. The skills are the value; the tool is the delivery mechanism.

---

## FAQ

### Do I need to know how to code?

No. The **sales, marketing, and internal-comms** skills work fine without any coding knowledge — just install and start asking Claude things in plain English. The developer/security/devops skills are written for engineers.

### Is my data sent anywhere?

Not by this repo. `install.sh` only copies files locally. Whatever data-sharing policy applies to the AI tool you use (Claude Code, Cursor, etc.) is the same before and after you install skills.

### Is this free?

Yes, this repo is free (MIT licensed). You'll pay for the AI tool you use Claude Code with — Anthropic has a free tier and paid tiers.

### Can I use this on Windows?

Yes. The installer is a Bash script, so on Windows you'll want either:
- **Windows Subsystem for Linux (WSL)** — install Ubuntu, run as on Linux.
- **Git Bash** — comes with [Git for Windows](https://git-scm.com/download/win).
- Or just copy the `departments/<dept>/skills/<skill>/` folders into `%USERPROFILE%\.claude\skills\` manually.

### Why are the security scripts not executable?

The four helper scripts under `departments/security/.../scripts/` ship without the executable bit to keep the clone simple. Either run them with `bash run-dast.sh`, or run once:

```bash
chmod +x departments/security/skills/security-audit/scripts/*.sh \
         departments/security/skills/secret-scanner/scripts/*.sh
```

### What if I want to uninstall?

Just delete the folder:

```bash
rm -rf ~/.claude/skills
```

Or remove only specific skills. Nothing else on your system is touched.

### A skill isn't triggering when I ask for it

Two things to check:

1. Does the file exist? `ls ~/.claude/skills/` — you should see the skill folder.
2. Is your request specific enough? Try naming the skill: "Use the `code-review` skill to …".

You can also edit the `description:` field in the SKILL.md to include words you'd naturally use.

### How are these skills different from just prompting ChatGPT?

A skill is a *reusable* prompt that follows a *rigorous* structure, co-exists with *reference material*, and *auto-triggers* without you having to re-paste it every time. Writing a good skill is a few hours of thought. Writing the same good prompt every time is a few hours a week, forever.

### Can I share my own skill here?

Yes please! See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Contributing

We want this to stay the highest-signal, most-practical skill collection on the web. If your team has a skill that makes real daily work better, open a PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- The skill template.
- Style rules (no emojis in skills, no unexplained jargon, examples must be runnable).
- How to add a whole new department.

---

## License

MIT. Use it, fork it, modify it, ship it. Attribution appreciated but not required. See [LICENSE](LICENSE).

---

## Acknowledgements

Skills here encode practices from:
OWASP (security), Conventional Commits (commit-message), Keep a Changelog (changelog), Core Web Vitals (performance-test), WCAG 2.1 (accessibility-audit), Martin Fowler's *Refactoring* (refactor), RFC 7807 & Google AIPs (api-design), the SRE / DORA body of work (deploy, incident-response, cost-optimizer), and thousands of hours of practitioner experience across the teams who contributed.
