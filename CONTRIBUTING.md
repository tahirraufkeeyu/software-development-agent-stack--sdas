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
safety: safe | writes-local | writes-shared | destructive
# Optional: declare the tech stacks this skill supports. Omit for
# fully stack-agnostic skills (code-review, commit-message, most of
# sales/marketing/internal-comms). See "Supported stacks and the
# detection-first pattern" below.
supported-stacks:
  - <stack-identifier-1>
  - <stack-identifier-2>
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
1. **Detect the stack first.** Run these read-only commands and record findings:
   - <`cat <file> 2>/dev/null`>
   - <`ls <dir> 2>/dev/null`>
   - <additional detection commands>
   Confirm the detected stack is in `supported-stacks`. If not, stop and report.
2. <next step of the actual procedure>
3. <...>

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

### The `safety` field

Every skill declares a safety level so tools reading the frontmatter (Claude Code plugins, IDE integrations, the installer, future dashboards) can decide whether to prompt for confirmation before running. Pick the level that matches the **most invasive** action the skill's `Procedure` section may perform:

| Level | Meaning | Typical examples |
|---|---|---|
| `safe` | Read-only. No filesystem writes, no network side effects, no external state change. | `code-review`, `secret-scanner`, `cluster-health`, `lead-research` |
| `writes-local` | Creates or edits files in the user's working tree only. No git push, no external side effects. | `test-writer`, `refactor`, `pipeline-builder`, `content-writer` |
| `writes-shared` | Reaches shared state that other people can observe or that the org depends on — but reversibly. Includes cluster config changes, cert rotations, opening PRs, sending drafts to review. | `monitoring-setup`, `ssl-certificate-manager`, `incident-response` |
| `destructive` | Irreversible or high-blast-radius: production deploys, data deletions, force pushes, sent messages to customers, provisioned paid cloud resources. | `deploy`, some `iac-generator` applies, live-fire comms |

Rules:
- Default to the **higher** level when unsure — better to over-warn than miss a destructive step.
- If the skill's procedure has multiple phases with different risk levels, pick the highest.
- Skills that only **generate** code or config (rather than applying it) are usually `writes-local`, not `destructive`. The apply step is a separate human action.
- The field is a promise to callers — if you later add a destructive action to the procedure, bump the level in the same PR.

### Supported stacks and the detection-first pattern

Many skills only make sense for a specific technology stack. `monitoring-setup` assumes Prometheus + Grafana on Kubernetes. `pipeline-builder` emits GitHub Actions, Azure DevOps, or GitLab CI YAML. `deploy` assumes a canary-capable orchestrator. Pretending these skills are stack-agnostic produces silent wrong output for anyone on a different stack.

The kit's approach is **discovery-first, opinionated once detected**:

1. **Declare the supported stacks in frontmatter.** Every stack-specific skill lists what it supports so callers can see coverage at a glance.
2. **Open the `Procedure` with detection.** Step 1 is always "run these read-only commands and determine which supported stack applies."
3. **Fail loud on unsupported stacks.** A `Constraints` line forbids producing output for a stack outside the declared list.

#### The `supported-stacks` field

Use kebab-case stack identifiers. For multi-component stacks, join with `+`. Examples used in this kit:

| Identifier | Meaning |
|---|---|
| `prometheus+grafana+k8s` | kube-prometheus-stack Helm chart on a Kubernetes cluster |
| `loki+promtail+k8s` | Grafana Loki with Promtail shippers on Kubernetes |
| `elk+k8s` | Elasticsearch + Logstash + Kibana (or ECK) on Kubernetes |
| `cert-manager+k8s` | cert-manager with Let's Encrypt on Kubernetes |
| `kubernetes` | Any recent Kubernetes cluster (no version-specific behaviour) |
| `helm+k8s` | Helm 3 for Kubernetes deployments |
| `terraform` | Terraform with any cloud provider |
| `bicep+azure` | Bicep on Azure Resource Manager |
| `pulumi` | Pulumi with any language backend |
| `github-actions` | GitHub Actions CI/CD |
| `azure-devops` | Azure DevOps Pipelines |
| `gitlab-ci` | GitLab CI/CD |
| `docker` | Docker / OCI images, any build tool |
| `openapi-3.x` | OpenAPI 3.0 / 3.1 specification |
| `playwright` / `cypress` | E2E browser testing frameworks |
| `chrome-devtools` | Chrome DevTools MCP (for performance + accessibility audits) |

When a skill supports more than one stack, list each on its own line:

```yaml
supported-stacks:
  - loki+promtail+k8s
  - elk+k8s
```

Omit the field entirely for stack-agnostic skills (`code-review`, `commit-message`, `debug`, most sales / marketing / internal-comms skills).

#### The detection-first Procedure pattern

Every stack-specific skill's `Procedure` opens with a detection step that uses read-only commands. The goal is evidence-based inference before any action. Template:

```markdown
## Procedure

1. **Detect the stack.** Run these checks in order; stop at the first conclusive match:
   - `kubectl get crd prometheuses.monitoring.coreos.com 2>/dev/null` — Prometheus Operator present?
   - `helm list -A 2>/dev/null | grep -E 'kube-prometheus-stack|prometheus'` — installed via Helm?
   - `ls monitoring/ observability/ 2>/dev/null` — existing dashboards / rules?
   - `grep -l 'datadog' package.json requirements.txt go.mod 2>/dev/null` — Datadog agent instrumented?

   Record the detected stack. Confirm it matches one of `supported-stacks`.
   If no supported stack is detected, STOP and report to the user with the
   evidence gathered and the supported stacks — do not produce output for
   an unsupported stack.

2. <next step of the procedure assumes the detected stack>
3. <...>
```

Three rules for good detection steps:

- **Read-only only.** Detection must not modify anything. No `helm install`, no `kubectl apply`, no `git commit`. If a command might write, don't use it here.
- **Fast.** A handful of `ls` / `cat` / `grep` / lightweight CLI reads. Avoid anything that blocks for more than a couple of seconds.
- **Specific.** Don't ask Claude to "figure out the stack." Give it concrete commands and what each one proves.

#### Fail-loud on unsupported stacks

Add this line (or equivalent) to every stack-specific skill's `Constraints`:

> Do not produce output for a stack outside `supported-stacks`. If detection shows an unsupported stack (e.g. Datadog when this skill only supports Prometheus), stop and report the detected stack and the supported list. Suggest the user request a dedicated skill for their stack rather than forcing this one.

Silent wrong output is the worst failure mode for a skill — the user walks away with config that looks right but targets the wrong system. The fail-loud rule makes that failure mode impossible.

#### When to split vs branch

Inside one skill, **two or three branches** are fine if each branch stays clear and specific. `log-aggregation` reasonably handles both `loki+promtail+k8s` and `elk+k8s` in one skill because the detection cleanly routes to one branch or the other.

When a domain has **four or more realistic stacks** (observability: Prometheus, Datadog, New Relic, CloudWatch, Honeycomb; CI/CD: GitHub Actions, GitLab, Azure DevOps, CircleCI, Jenkins), split into dedicated skills and add a lightweight router skill on top that only does detection and hand-off. Don't try to cover five stacks in one 400-line `Procedure`.

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

### The `skillkit.dev` customizer

Every skill in this kit gets a "Customise for your organisation" button on its `skillkit.dev` page. The customizer lets a user rewrite the SKILL.md for their environment (tech stack, scale, constraints, free-text extras) via an LLM — fully browser-side, no backend.

You don't have to do anything extra for your skill to participate. If the SKILL.md follows the conventions above (valid frontmatter, required H2 sections, detection-first Procedure for stack-specific skills, fail-loud Constraints), the customizer's system prompt already preserves everything important when it rewrites.

A few things to keep in mind as a skill author:

- **Write the examples honestly.** The LLM adapts examples to the user's stack; if your examples are copy-paste-real for the default stack, the rewrite has good material to work from. Handwavy or pseudo-code examples produce handwavy rewrites.
- **Keep Constraints specific.** The customizer system prompt forbids lowering safety or removing warnings, but vague Constraints don't survive rewrites cleanly. Concrete bans (`Never commit raw API keys — use Secrets Manager or sealed-secrets`) carry through.
- **Be concrete about the default stack.** If your skill is Prometheus-specific, say so in `supported-stacks` and the Detection step. The customizer knows to add new stacks only when the rewrite actually handles them — vague defaults confuse this.
- **If a skill legitimately can't be rewritten** (e.g. `secret-scanner` works for git-based flows only and wouldn't meaningfully customize), that's fine — the rewrite will largely mirror the original and that's the correct outcome.

The customizer does NOT:

- Send anything to the skillkit.dev server. All LLM calls are browser → openrouter.ai direct.
- Modify the kit's SKILL.md files. The customizer returns a new document the user downloads or installs locally — the upstream stays unchanged.
- Store user API keys or customizations on our servers. Everything is in the user's `localStorage`.

If you're iterating on a skill and want to see how it customizes under common scenarios, run the site locally (`cd site && npm run dev`), open the skill's page, and click Customise. You'll need your own OpenRouter key; the settings page at `/settings` walks you through it.

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
