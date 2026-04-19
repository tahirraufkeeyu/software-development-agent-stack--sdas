---
name: secret-scanner
description: Use when the user asks to "scan for secrets", "check for leaked credentials", onboarding a new repo, or before open-sourcing. Performs deep git history scan with Gitleaks and TruffleHog, diffs against an allowlist, triages false positives, and guides credential-rotation-first remediation via git filter-repo or BFG.
safety: safe
---

## When to use

Trigger this skill on any of:

- "Scan this repo for secrets / leaked keys / API tokens."
- "We think a credential was committed — help us remediate."
- "Repo is going public next week."
- Pre-merge hook that needs to refuse commits with new secrets.

Do not use this skill for live runtime secret detection (key rotation
monitoring, cloud config scanning). Use it for code-at-rest and git history
only.

## Inputs

- `REPO_PATH` (default: `.`) — path to the git repo.
- `ALLOWLIST` (default: `.gitleaks.toml` or `.secret-scanner-allowlist.yaml`
  at repo root) — known false positives.
- `OUT_DIR` (default: `./secret-scan-out`).
- `SCAN_REFLOG` (default: `1`) — also scan reflog + stash refs.
- Optional env:
  - `TRUFFLEHOG_CONFIG` — path to a custom trufflehog config.
  - `REDACT` (default: `1`) — redact matched values in reports.

## Outputs

- `gitleaks-report.json` — raw Gitleaks findings.
- `trufflehog-report.json` — raw TruffleHog findings.
- `secrets.deduped.json` — unified, allowlist-filtered, deduplicated result.
- `secrets-report.md` — human report with per-finding remediation steps.

Each unified record:
```
{
  "id": "sha256(commit|file|rule|match)[0:12]",
  "rule": "aws-access-key",
  "file": "src/infra/deploy.sh",
  "commit": "a1b2c3d",
  "author": "alice@example.com",
  "date": "2024-06-12T09:14:22Z",
  "line": 42,
  "redacted_match": "AKIA****************",
  "verified": true,
  "severity": "critical",
  "allowlisted": false
}
```

## Tool dependencies

- `git` >= 2.30.
- `gitleaks` >= 8.18 (https://github.com/gitleaks/gitleaks).
- `trufflehog` >= 3.63 (https://github.com/trufflesecurity/trufflehog).
- `jq` for merging.
- Optional: `git-filter-repo` (preferred over BFG) for rewriting history.

## Procedure

1. Confirm `$REPO_PATH` is a git repo (`git rev-parse --is-inside-work-tree`).
2. Fetch all refs first: `git fetch --all --tags --prune`.
3. Run `scripts/nuclear-scan.sh "$REPO_PATH" "$OUT_DIR"` which executes
   Gitleaks (detect + protect), TruffleHog over the git file URI, and
   iterates branches, tags, reflog, and stash refs.
4. Merge the two JSON outputs. Key by
   `(commit_sha, file_path, rule_id, match_sha256)` and dedupe.
5. Apply allowlist: drop records whose `(file_path, rule_id)` pair matches a
   regex in the allowlist. Every drop keeps a `skipped_by_allowlist`
   counter that is logged.
6. Triage: for every remaining record,
   - Verify with TruffleHog's `--only-verified` style detector when possible
     (sets `verified: true|false`).
   - Classify severity: verified live credential -> Critical; historical
     credential known rotated -> High; placeholder or test -> Low.
7. Emit `secrets-report.md` containing:
   - Top-line counts by severity.
   - A "Remediation sequence" section (always this order):
     1. Rotate the credential at the issuer (AWS, GitHub, Stripe, ...).
        Never do history rewrite first — a rewritten commit doesn't revoke a
        live key.
     2. Invalidate any cached credential (CI secret store, deploy
        platform env vars, developer laptops).
     3. Rewrite history with `git filter-repo` (preferred) or BFG.
     4. Force-push (coordinate with team). Every collaborator re-clones.
     5. Update the allowlist with a post-rotation hash so the dead secret
        doesn't re-trigger alerts.
8. Provide exact commands tailored to each finding:
   - `git filter-repo --invert-paths --path <file>` when the file should go.
   - `git filter-repo --replace-text replacements.txt` when only the
     secret should be scrubbed, preserving surrounding content.
9. Return non-zero if any verified Critical remains.

## Examples

### Example 1 — Scanning before open-sourcing

```
REPO_PATH=$PWD OUT_DIR=./scan ./scripts/nuclear-scan.sh "$REPO_PATH" ./scan
jq '.[] | select(.severity=="critical")' scan/secrets.deduped.json
```

Expected `secrets-report.md` excerpt:

```
## Critical (verified live credentials): 2

### 1. AWS access key in src/infra/deploy.sh
- Rule: aws-access-key
- First appeared: commit a1b2c3d (2024-06-12, alice@example.com)
- Redacted match: AKIA****************
- Remediation:
  1. Rotate in AWS IAM: aws iam create-access-key --user-name deploy-bot
     then aws iam delete-access-key --access-key-id AKIA****************
  2. Update GitHub Actions secret AWS_ACCESS_KEY_ID.
  3. Rewrite history:
     git filter-repo --replace-text <(echo 'AKIA****************==>REDACTED')
  4. Force-push: git push --force-with-lease origin --all --tags
```

### Example 2 — Pre-merge gate on CI

```
./scripts/nuclear-scan.sh . ./out || {
    echo "Secrets detected — see ./out/secrets-report.md"
    exit 1
}
```

Expected: exit 0 on clean, exit 2 when verified Critical is present; prints
human-readable log and writes a SARIF-compatible report consumable by GitHub
code scanning.

## Constraints

- Never print full secret material in logs or the report. Always redact to
  `prefix****************suffix` (retain first 4 and last 4 chars).
- Never call an issuer's API to rotate for the user — provide the command,
  let the human run it. Rotation must be auditable.
- Never recommend `git push --force` without `--force-with-lease`.
- Refuse to run on a repo with uncommitted changes unless
  `ALLOW_DIRTY=1` is set — history rewrite on a dirty tree loses work.
- Do not scan the `.git/` directory directly as a file tree — use git object
  walk (Gitleaks/TruffleHog do this).

## Quality checks

- [ ] Every finding has a `commit` and `author` — if either is missing the
      record is malformed.
- [ ] Allowlist hits are logged with the matching rule so drift is visible.
- [ ] `secrets-report.md` contains the five-step remediation sequence
      verbatim.
- [ ] Redaction regex confirmed on at least one sample per finding type.
- [ ] Exit code matches policy: 0 clean, 2 on verified Critical, 1 on
      tool/setup failure.
