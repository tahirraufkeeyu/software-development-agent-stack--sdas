# DevOps Department

A bundle of Claude Code skills for platform, SRE, and DevOps teams. These skills codify the repetitive, high-stakes work that platform teams do every day: shipping code safely, keeping pipelines green, provisioning infrastructure that passes policy review, and responding calmly when production misbehaves.

## Why this department

Platform engineers sit between application teams and cloud infrastructure. The work is broad (CI, CD, IaC, Kubernetes, cost, incidents) and the blast radius of a single mistake is large. These skills reduce toil and provide guardrails:

- Consistent deploy procedures with rollback paths baked in.
- Hand-written pipeline patterns that avoid the usual footguns (secret leakage, cache poisoning, runaway minutes).
- Terraform/Bicep/Pulumi generators that pass Checkov/tfsec out of the box.
- Helm charts that lint cleanly and diff against live clusters before rollout.
- A repeatable incident-response loop that produces a real postmortem, not a Slack archaeology project.
- Cost analysis that turns billing exports into rightsizing tickets.

## Skills

| Skill | Description | Complexity |
|-------|-------------|------------|
| `deploy` | Canary/blue-green rollout with health gates and automatic rollback on SLO breach. | High |
| `pipeline-builder` | Generate CI/CD YAML for GitHub Actions, Azure DevOps, or GitLab CI based on stack. | Medium |
| `iac-generator` | Produce Terraform HCL, Bicep, or Pulumi for AKS/EKS, RDS, S3, VNet/VPC, IAM. | High |
| `helm-charts` | Scaffold and validate a Helm chart (Chart.yaml, values, templates, lint, diff). | Medium |
| `incident-response` | Triage, communicate, mitigate, and draft a blameless postmortem. | High |
| `cost-optimizer` | Analyze billing exports, flag idle/over-provisioned resources, quantify savings. | Medium |

## Quick install

```bash
./install.sh devops
```

This copies `departments/devops/skills/*` into `~/.claude/skills/` (or your project-local `.claude/skills/` directory). Restart Claude Code so the new SKILL.md files are indexed.

## Recommended MCP servers

The skills are useful on their own, but they become much more powerful when paired with MCP servers that let Claude execute and verify steps directly:

- **GitHub MCP** (`@modelcontextprotocol/server-github`) — read PRs, open issues, inspect workflow runs, dispatch workflows. Required by `pipeline-builder` and `deploy` for end-to-end flows.
- **Kubernetes MCP** (`mcp-server-kubernetes` or equivalent) — run `kubectl get/describe/logs`, `helm list`, `helm upgrade`. Required by `deploy`, `helm-charts`, and `incident-response`.
- **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`) — read/write repo files, IaC modules, and pipeline YAML. Used by every skill.
- **Cloud provider MCP (optional)** — e.g. AWS MCP, Azure MCP, or GCP MCP for cost queries, resource inventory, and drift detection. Required by `cost-optimizer` and speeds up `iac-generator`.
- **Slack MCP (optional)** — post status updates from `incident-response` without switching tools.

Minimum viable set for this department: GitHub MCP + Kubernetes MCP + Filesystem MCP.

## Recommended workflow

A green-field service typically flows through these skills in order:

```
iac-generator  →  pipeline-builder  →  deploy  →  incident-response (when needed)
     |                   |                |                |
   infra            CI/CD YAML       rollout plan     postmortem
```

1. **iac-generator** — provision the cluster, database, networking, and IAM. Land infra via MR with `plan` output attached.
2. **pipeline-builder** — scaffold the build + deploy pipeline for the repo (matrix tests, container build, registry push, environment gates).
3. **helm-charts** (in parallel with 2) — produce the chart the pipeline will deploy.
4. **deploy** — run the canary/blue-green rollout, verify health, promote or roll back.
5. **incident-response** — when the pager fires, run the triage loop and land a postmortem.
6. **cost-optimizer** — run quarterly against billing exports to catch drift in spend.

## Layout

```
departments/devops/
  README.md
  skills/
    deploy/
      SKILL.md
      references/deployment-checklist.md
    pipeline-builder/
      SKILL.md
      references/github-actions-patterns.md
      references/azure-devops-patterns.md
      references/gitlab-ci-patterns.md
    iac-generator/
      SKILL.md
      references/iac-best-practices.md
    helm-charts/
      SKILL.md
    incident-response/
      SKILL.md
      references/postmortem-template.md
    cost-optimizer/
      SKILL.md
```
