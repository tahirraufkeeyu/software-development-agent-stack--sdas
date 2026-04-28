# Security Policy

## Reporting a vulnerability

If you've found a security issue in this project, please **do not open a public GitHub issue**. Public issues will be visible to other users before a fix is available.

Instead, report privately via either of these channels:

- **GitHub Security Advisory** (preferred) — open a private advisory at
  [github.com/tahirraufkeeyu/software-development-agent-stack--sdas/security/advisories/new](https://github.com/tahirraufkeeyu/software-development-agent-stack--sdas/security/advisories/new).
- **Email** — `tahir@keeyu.app` with the subject line `[skillskit security]`.

Please include:

- A description of the issue and the impact (what an attacker could do).
- Steps to reproduce, ideally a minimal proof of concept.
- The commit SHA / release tag where you observed the issue.
- Any suggested mitigation, if you have one.

## What to expect

| When | What |
|---|---|
| Within 3 working days | Acknowledgement that the report was received. |
| Within 7 working days | Initial triage — confirmed, needs more info, or out of scope. |
| Within 90 days | A fix released, or a public discussion of why a fix isn't possible / is being deferred. |

We'll credit reporters in the release notes unless you ask us not to. We do not currently run a paid bug-bounty program.

## Scope

In scope:

- The `skillskit` CLI (this repo) — code execution, path traversal, command injection in any subcommand, malicious skill installation.
- The install scripts — `scripts/install-remote.sh` and `scripts/install-remote.ps1` — anything that could result in arbitrary code execution beyond what the user expects.
- The `site/` Astro site — XSS, content injection, secrets accidentally bundled into the static site.
- The skill catalog (`departments/`) — skills that recommend insecure commands by default, or that exfiltrate data.

Out of scope (please do not report these):

- Reports against third-party tools the skills *invoke* (Trivy, Gitleaks, ZAP, etc.) — report those upstream.
- Findings that require an attacker who already has write access to a target's `~/.claude/skills/` or shell — that's a compromised dev environment, not a SDAS issue.
- Best-practice guidance you disagree with in a SKILL.md — open a regular issue or PR.
- Theoretical issues without a working PoC.

## Supported versions

We support the latest released version on the `main` branch. Older releases are not patched; please upgrade.

## Disclosure

We follow a coordinated-disclosure model. After a fix lands, we'll publish a GitHub Security Advisory describing the issue, the affected versions, and the fix. If you reported the issue, we'll coordinate the disclosure timing with you.
