---
name: release-to-prod
description: Use when a merged PR needs to be shipped to production end-to-end. Chains CI verification, canary deploy, SLO-driven auto-rollback, and changelog generation into a single auditable release run.
safety: destructive
produces: devops/reports/release-<version>.md
consumes:
  - devops/status/ci-green.json
  - devops/status/deploy-result.json
chains:
  - pipeline-builder
  - deploy
  - incident-response
  - changelog
---

## When to use

- A PR (or a set of PRs) has merged to `main` and the release train is ready to leave staging.
- A hotfix must go to prod with the same canary + auto-rollback guarantees as a scheduled release.
- A cut-over requires a single artifact (the release report) for audit, compliance, or change-advisory review.
- The caller wants one orchestration step — not four manual handoffs between CI, deploy, on-call, and docs.

Do not use for dev/staging-only deploys (call `deploy` directly), for emergency `kubectl rollout undo` in the middle of an active incident (call `incident-response` directly), or when the commit has not yet merged to the release branch.

## Chained skills

Executed strictly in this order:

1. `pipeline-builder` — read-only check that the CI pipeline for the target SHA finished green. No mutation; consumes GitHub Actions / GitLab CI / Azure DevOps status and emits `devops/status/ci-green.json`.
2. `deploy` — performs the canary-aware rollout to the target environment (`5% -> 25% -> 100%`) with SLO gates between each step. Emits `devops/status/deploy-result.json`.
3. `incident-response` — invoked ONLY if the SLO gate inside `deploy` trips. Runs auto-rollback, opens an incident, and drafts the postmortem skeleton with the offending PR/commit pre-populated.
4. `changelog` — enumerates the PRs merged since the previous release tag, groups them by type (feat/fix/chore/docs), and renders user-facing release notes.

## Inputs

- `environment` — target env (`prod-us-east-1`, `prod-eu-west-1`, etc.).
- `version` — semver tag to cut (e.g. `v2.14.0`).
- `sha` — full git SHA of the commit to release. Must be on the release branch.
- `service` — the Kubernetes Deployment being released (e.g. `checkout-api`).
- `canary_steps` — default `[5, 25, 100]`; override per-service risk tolerance.
- `slo` — object: `{ error_rate_max: 0.01, p95_latency_ms: 400, window_minutes: 5 }`.
- `previous_release_tag` — the last green release tag, used for changelog range.
- `approvers` — GitHub Environment approvers required for prod.
- `dashboards` — map of `{ name: url }` for the release report (Grafana, Datadog, etc.).

## Outputs

- `devops/reports/release-<version>.md` — the single source of truth for this release. Always written, whether the release succeeds, aborts, or rolls back.
- `devops/status/ci-green.json` — CI status snapshot for the SHA.
- `devops/status/deploy-result.json` — per-canary-stage timing, SLO metric values, and final rollout state.
- A Markdown deploy note suitable for `#deploys`.
- If rollback occurred: `incidents/INC-YYYY-MM-DD-NN.md` postmortem draft.

## Tool dependencies

- `gh` >= 2.40 for CI status and PR enumeration.
- `kubectl` >= 1.28, `helm` >= 3.12, `kubectl argo rollouts` plugin (if canary strategy is Argo).
- `jq`, `yq` for parsing JSON/YAML status.
- `git` with read access to the release branch and tags.
- Prometheus/Datadog/CloudWatch query access for the SLO gate.
- Slack or PagerDuty webhook for deploy notes (optional but recommended).
- All tool requirements of the four chained skills are transitively required.

## Procedure

### 1. Validate inputs

```bash
test -n "$VERSION" && test -n "$SHA" && test -n "$ENVIRONMENT"
git cat-file -e "$SHA" || { echo "SHA not found"; exit 1; }
git tag --list | grep -qx "$VERSION" && { echo "Tag already exists"; exit 1; }
```

Abort if any assertion fails. Print the unresolved input and stop.

### 2. CI gate (chain: `pipeline-builder`)

Read-only status check for the SHA. No pipeline YAML is generated here — only verification.

```bash
gh api "repos/${ORG}/${REPO}/commits/${SHA}/check-runs" \
  --jq '{sha: "'${SHA}'", runs: [.check_runs[] | {name, status, conclusion}]}' \
  > devops/status/ci-green.json

jq -e '.runs | all(.conclusion == "success")' devops/status/ci-green.json \
  || { echo "CI not green for $SHA"; exit 2; }
```

If any check failed or is still in progress, halt the orchestrator. Write the failing check name into the release report under a `Blocked` header and exit with code `2`.

### 3. Tag the release

```bash
git tag -a "$VERSION" "$SHA" -m "Release $VERSION"
git push origin "$VERSION"
```

Skipped if the chart deployment uses digest pinning and the caller does not want a git tag yet (dry-run mode).

### 4. Canary deploy (chain: `deploy`)

Invoke `deploy` with `strategy: canary` and the caller-supplied SLO and steps. Each step runs the SLO query configured inside `deploy`; a breach triggers `abort + undo` locally, and the orchestrator catches the non-zero exit.

```bash
for step in "${CANARY_STEPS[@]}"; do
  START=$(date -u +%FT%TZ)
  kubectl -n "$ENVIRONMENT" argo rollouts set image "$SERVICE" \
    "$SERVICE=ghcr.io/${ORG}/${SERVICE}@${DIGEST}"
  kubectl -n "$ENVIRONMENT" argo rollouts promote "$SERVICE"
  kubectl -n "$ENVIRONMENT" argo rollouts status "$SERVICE" --timeout 10m

  if ! ./scripts/check-slo.sh "$SERVICE" "$step"; then
    jq -n --arg s "$step" --arg t "$START" \
      '{aborted_at_step: $s, started: $t, state: "slo_breach"}' \
      > devops/status/deploy-result.json
    SLO_BREACHED=1
    break
  fi
  echo "step $step ok at $(date -u +%FT%TZ)"
done
```

### 5. Incident branch (chain: `incident-response`)

Only runs if step 4 set `SLO_BREACHED=1`.

```bash
if [ "${SLO_BREACHED:-0}" = "1" ]; then
  kubectl -n "$ENVIRONMENT" argo rollouts abort "$SERVICE"
  kubectl -n "$ENVIRONMENT" argo rollouts undo "$SERVICE"
  kubectl -n "$ENVIRONMENT" rollout status deploy/"$SERVICE" --timeout=10m

  INC_ID="INC-$(date -u +%Y-%m-%d)-$(printf '%02d' "$(ls incidents/ 2>/dev/null | grep "$(date -u +%Y-%m-%d)" | wc -l | awk '{print $1+1}')")"
  # Hand off to incident-response with pre-populated context:
  #   - service, version, SHA, breached metric, breach timestamp
  #   - the set of PRs between previous_release_tag..SHA (suspect list)
  # incident-response writes incidents/$INC_ID.md
  exit 3
fi
```

The orchestrator stops here on a rollback path — the changelog step is skipped because the release was aborted. The release report is still written and marked `ABORTED`.

### 6. Changelog (chain: `changelog`)

Only runs on the success path.

```bash
PRS=$(gh pr list --state merged --search \
  "merged:>$(git log -1 --format=%cI "$PREVIOUS_RELEASE_TAG")" \
  --json number,title,author,labels --limit 200)

echo "$PRS" | jq '.' > devops/status/prs-in-release.json
# changelog skill reads prs-in-release.json and renders:
#   - Features
#   - Fixes
#   - Chores / internal
# into devops/reports/release-<version>.md under the "## Changes" section.
```

### 7. Write the release report

`devops/reports/release-<version>.md` always includes:

- Release header: version, SHA, environment, start/end UTC timestamps, release captain.
- CI summary: commit SHA, all check-run names, conclusions.
- Deploy summary: table of `step | started_at | ended_at | error_rate | p95_ms | result`.
- Rollback section (if triggered): breached metric, value vs threshold, rollback duration, linked incident ID.
- Changelog section: grouped PRs with links, authors, and reviewers.
- Dashboard links: from `inputs.dashboards`.
- Sign-off: approver GitHub handle and timestamp.

## Examples

### Example 1 — clean release of `v2.14.0`

Inputs:

```yaml
environment: prod-us-east-1
version: v2.14.0
sha: 9a3f1c8b7e2d4f5a6c8b9d1e2f3a4b5c6d7e8f90
service: checkout-api
canary_steps: [5, 25, 100]
slo: { error_rate_max: 0.005, p95_latency_ms: 300, window_minutes: 5 }
previous_release_tag: v2.13.2
approvers: ["@acme/sre"]
```

Observed flow:
- `pipeline-builder`: 12 check-runs, all `success`. `ci-green.json` written.
- `deploy`: canary 5% (error rate 0.21%, p95 212 ms, OK), 25% (0.24%, 225 ms, OK), 100% (0.22%, 220 ms, OK).
- `changelog`: enumerates 7 merged PRs (3 feat, 3 fix, 1 chore) between `v2.13.2..v2.14.0`.
- Report `devops/reports/release-v2.14.0.md` written with total duration 28 min, status `SUCCESS`.

### Example 2 — canary-triggered rollback at 25%

Inputs identical to Example 1 except SHA and version (`v2.14.1`). During the 25% stage, the SLO gate observes:

```
error_rate   = 0.032   # threshold 0.005
p95_latency  = 0.287s  # threshold 0.300s (still OK)
```

Orchestrator path:
- `deploy` fails the 25% gate and returns non-zero.
- Orchestrator executes `argo rollouts abort + undo`; previous revision restored in 1 m 42 s.
- `incident-response` is invoked with pre-populated context and creates `incidents/INC-2026-04-19-02.md` containing timeline, detection method (Prometheus alert `HighErrorRate`), rollback evidence, and the suspect PR (`#4821 — refactor: consolidate checkout retry logic`) auto-flagged as the likely regression source.
- `changelog` step is skipped.
- `devops/reports/release-v2.14.1.md` is written with status `ABORTED`, rollback duration, link to `INC-2026-04-19-02`, and the offending PR author CC'd.

## Constraints

- Never skip the CI gate. A red or pending SHA must not reach `deploy`.
- Never promote past the first canary step that breaches an SLO; auto-rollback is mandatory.
- Never overwrite an existing `release-<version>.md`. If the file exists, append a `-retry<N>` suffix.
- Never call `incident-response` outside the rollback branch — it creates incident records and paging noise.
- Do not run two `release-to-prod` invocations concurrently against the same service. Use a file lock at `devops/status/release-<service>.lock` or a CI concurrency group.
- Do not tag the release before CI is green — an orphan tag misleads downstream consumers.
- This orchestrator is `destructive`: a prod rollout cannot be undone except by rolling back, and the audit artifact (release report + tag) is permanent.
- All inputs that reference paths are relative to the repository root; no absolute paths are written into artifacts.

## Quality checks

- `ci-green.json` exists and `jq '.runs | all(.conclusion == "success")'` returns `true` before step 4 starts.
- `deploy-result.json` is present for every canary step actually executed, with real Prometheus values (not placeholders).
- `helm -n "$ENVIRONMENT" history "$SERVICE"` shows the new revision at the top on success; shows the previous revision at the top after rollback.
- `git tag --verify "$VERSION"` succeeds; tag points at the expected SHA.
- Release report front-matter includes version, SHA, environment, and status (`SUCCESS` | `ABORTED`).
- If `ABORTED`, an incident file exists and is linked from the release report.
- Changelog section cites every PR by number and links to the GitHub URL; no unmatched `Merge pull request` commits remain.
- `actionlint` / `kubeconform` errors from chained skills are bubbled up, not swallowed.
- Total release duration (ingest to report) is recorded and compared to the previous release for drift tracking.
