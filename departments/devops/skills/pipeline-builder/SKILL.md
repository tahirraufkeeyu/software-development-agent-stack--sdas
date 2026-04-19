---
name: pipeline-builder
description: Use when a repository needs a new CI/CD pipeline or a major revision to an existing one. Generates GitHub Actions, Azure DevOps, or GitLab CI YAML tailored to the project stack (Node, Python, Go, container) with matrix builds, caching, artifact publishing, and environment-gated deploys.
---

## When to use

- Bootstrapping CI for a new service.
- Migrating a pipeline between platforms (Jenkins -> GitHub Actions, Travis -> GitLab CI, etc.).
- Adding a deploy stage to an existing CI that only runs tests.
- Consolidating ad-hoc `.yml` files into reusable workflows/templates.

Do not use for platform-wide shared runner configuration or org-level policy; that is infra, not a pipeline.

## Inputs

- `platform` — `github-actions` | `azure-devops` | `gitlab-ci`.
- `stack` — `node` | `python` | `go` | `container` | combination (monorepo).
- `package_manager` — `npm` | `pnpm` | `yarn` | `pip` | `poetry` | `uv` | `go mod`.
- `test_matrix` — OS and language version matrix (e.g. Node `[18, 20]` on `ubuntu-latest`).
- `registry` — `ghcr.io` | `docker.io` | `<acr>.azurecr.io` | `<aws_account>.dkr.ecr.<region>.amazonaws.com` | `registry.gitlab.com`.
- `deploy_targets` — list of environments with approvers (e.g. `[{name: staging}, {name: prod, approvers: ["sre-team"]}]`).
- `monorepo_paths` — optional list of paths that trigger specific pipelines.
- `release_strategy` — `semantic-release` | `manual-tag` | `none`.

## Outputs

- One or more YAML files at the correct platform-specific path:
  - GitHub Actions: `.github/workflows/*.yml` plus optional `.github/workflows/reusable-*.yml`.
  - Azure DevOps: `azure-pipelines.yml` and `pipelines/templates/*.yml`.
  - GitLab CI: `.gitlab-ci.yml` and `ci/*.yml` includes.
- Dependabot/Renovate config where applicable.
- A short README section explaining variables, secrets, and environments that must be created out-of-band.

## Tool dependencies

- `yq` or `yamllint` to validate generated YAML.
- `actionlint` for GitHub Actions.
- `gitlab-ci-lint` (or GitLab API `/ci/lint`) for GitLab.
- `az pipelines validate` or Azure DevOps REST API for Azure.
- `gh` CLI if the skill also creates environments/secrets.

## Procedure

### 1. Identify stack and conventions

Inspect the repo for:
- Lockfile and package manager (`package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `uv.lock`, `go.sum`).
- `Dockerfile` location(s).
- Existing `.github/`, `azure-pipelines.yml`, or `.gitlab-ci.yml`.
- Monorepo markers (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `go.work`).

### 2. Draft the stage graph

All platforms follow the same logical stages:

```
lint -> test (matrix) -> build -> scan -> publish -> deploy(staging) -> deploy(prod, gated)
```

For monorepos, replicate per affected package using path filters.

### 3. Generate platform YAML

Pick the reference file for the target platform and compose snippets:

- GitHub Actions: see `references/github-actions-patterns.md`.
- Azure DevOps: see `references/azure-devops-patterns.md`.
- GitLab CI: see `references/gitlab-ci-patterns.md`.

Always include:
- Caching keyed by the lockfile hash.
- Concurrency group to cancel superseded runs on the same ref.
- Least-privilege token scopes (`permissions:` in GHA, scoped service connections in ADO, `id_tokens:` in GitLab).
- Container publish step that tags with both `sha-<short>` and the semver tag.
- Environment-scoped deploy jobs with required reviewers for prod.

### 4. Validate

```bash
actionlint .github/workflows/*.yml
yamllint -s .gitlab-ci.yml
az pipelines validate --organization https://dev.azure.com/$ORG --project $PROJECT --yaml-path azure-pipelines.yml
```

Run the lint step and fix every warning (no `shellcheck` disables left behind).

### 5. Provision environments and secrets

Document required secrets/variables in a table in the repo README. Never inline secrets in YAML.

```bash
gh secret set REGISTRY_TOKEN -b "$TOKEN" -R acme/checkout-api
gh api -X PUT repos/acme/checkout-api/environments/production -f 'wait_timer=0' \
  -F 'reviewers[][type]=Team' -F 'reviewers[][id]=1234'
```

### 6. Smoke the pipeline

- Open a draft PR that touches a non-functional file and confirm the pipeline runs only the expected jobs.
- Verify cache hit on the second run.
- Verify prod deploy job is gated by the required reviewer.

## Examples

### Example 1 — Node service with GitHub Actions

Inputs: `platform=github-actions`, `stack=node`, `package_manager=pnpm`, `test_matrix={os: [ubuntu-latest], node: [20]}`, `registry=ghcr.io`, `deploy_targets=[staging, {prod, approvers:[sre]}]`.

Generates `.github/workflows/ci.yml` (lint + test + build), `.github/workflows/release.yml` (semantic-release + GHCR push), and `.github/workflows/deploy.yml` (environment-gated EKS deploy via OIDC). See `references/github-actions-patterns.md` for the full reusable workflow.

### Example 2 — Python monorepo with GitLab CI

Inputs: `platform=gitlab-ci`, `stack=python`, `package_manager=uv`, `monorepo_paths=["services/api/**", "services/worker/**"]`, `registry=registry.gitlab.com`.

Generates `.gitlab-ci.yml` that `include:`s `ci/python.yml` and uses `rules: changes:` per path, a shared `test` template with cache keyed on `uv.lock`, and `needs:` DAG edges so `build:api` and `build:worker` run in parallel after their respective `test` jobs. Prod deploy uses a manual `when: manual` gate and `environment: production`.

## Constraints

- Never write secrets to the repo. Use the platform's secret store and reference by name.
- Never use `${{ github.event.pull_request.head.ref }}` or similar user-controlled input directly in a `run:` step (injection). Pass through `env:` with quoting.
- Never run `docker login` with `--password` on the command line; use `--password-stdin`.
- Never disable checksum verification (`pip install --trusted-host`, `npm --ignore-scripts` is fine; `--unsafe-perm` is not).
- Pin third-party actions to a full commit SHA, not a floating tag.
- Keep each workflow/pipeline file under 400 lines; extract reusable templates when it grows beyond.

## Quality checks

- YAML passes the platform linter with zero warnings.
- All `uses:`/`template:` references are pinned by SHA or versioned include.
- No secret is echoed, logged, or passed as a command-line argument.
- Concurrency group set for PR-triggered workflows.
- Cache key includes the lockfile hash.
- Prod deploy job is blocked on an environment with at least one required reviewer.
- Image tags include both `sha-<short>` and a semver (`v1.2.3`) when `release_strategy` is set.
- Artifacts and caches have explicit retention (`retention-days`, `expire_in`).
- Pipeline completes end-to-end for a trivial change in under the target wall-clock (document the target in the README).
