---
name: secret-remediation
description: Use when secret-scanner has produced findings and leaked credentials need to be remediated. Rotates each credential at its provider, invalidates the old one, rewrites git history, updates allowlists for confirmed false positives, and installs prevention controls (pre-commit hook, CI gate, secret manager).
safety: writes-shared
produces: security/remediation/secrets-<date>.md
consumes:
  - security/findings/secrets.json
---

## When to use

- `secret-scanner` has produced `security/findings/secrets.json` containing one or more findings.
- A collaborator has opened a ticket "leaked credential found in commit X".
- A secret-rotation deadline is approaching and you need a structured remediation pass.
- A vendor (GitHub secret scanning, AWS Trusted Advisor) has notified you of a leaked credential.

Do not use this skill to re-scan the repo — that's `secret-scanner`. Do not use it to triage non-secret high-entropy strings — treat those as false positives and document the allowlist decision here.

## Inputs

- `security/findings/secrets.json` from `secret-scanner`, or an equivalent list of findings.
- Provider console access for every credential type in the findings (AWS, GitHub, Stripe, etc.). Without rotation access this skill cannot complete its primary step.
- Repo write access and `git filter-repo` or BFG installed locally.
- Collaborator list so notification of the forced-push can be scoped.

## Outputs

- `security/remediation/secrets-<date>.md` — the audit-trail report for this remediation cycle.
- A rewritten git history on all affected branches (force-pushed) with secret values replaced.
- `.gitleaksignore` updates for confirmed false positives only.
- New prevention controls: pre-commit hook config, CI workflow, secret-manager entry.

## Tool dependencies

- `git` with `git-filter-repo` (`pip install git-filter-repo`) or BFG Repo-Cleaner.
- `gitleaks` for pre-commit + CI hooks.
- Cloud / SaaS provider CLIs: `aws`, `gh`, `stripe`, `twilio`, `gcloud`, etc.
- `kubectl` if secrets are consumed by Kubernetes workloads.
- A secret manager: AWS Secrets Manager, HashiCorp Vault, Doppler, 1Password, or similar.

## Procedure

1. **Triage.** Load `security/findings/secrets.json` and classify each finding:
   - `aws-access-key` — starts with `AKIA`, 20 chars.
   - `github-pat` — starts with `ghp_`, `gho_`, or `ghs_`.
   - `stripe-key` — starts with `sk_live_` or `sk_test_`.
   - `gcp-service-account` — JSON with `"type": "service_account"`.
   - `db-connection-string` — `postgres://user:pass@host`, `mysql://…`, etc.
   - `generic-high-entropy` — needs a provenance check.
   - `false-positive` — SRI hash, JWT in a test fixture, etc. Requires explicit evidence in the report.

2. **Rotate at the provider before touching git.** The old credential must be invalidated first, otherwise any force-push makes the secret more visible (git reflog + warm CDN caches). Per provider:

   AWS access key:
   ```bash
   aws iam create-access-key --user-name <user>        # new key
   # update consumers — Secrets Manager, ECS task def, CI env, etc.
   aws iam update-access-key --user-name <user> --access-key-id <OLD> --status Inactive
   # verify no 4xx or successful API calls using old key
   aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=<OLD> --start-time <5m-ago>
   aws iam delete-access-key --user-name <user> --access-key-id <OLD>
   ```

   GitHub Personal Access Token:
   - Delete at `https://github.com/settings/tokens` (classic) or `/settings/personal-access-tokens` (fine-grained).
   - Mint replacement with minimal scopes (`contents:read` + `pull_request:write` is enough for most CI uses).
   - Store in secret manager, never in `.env`.

   Stripe / Twilio / OpenAI / Slack webhook:
   - Dashboard → API keys → revoke the leaked key.
   - Issue a new one scoped to the service that consumed it.
   - Roll the consumer service config.

   Database password:
   - Rotate in KMS / Vault: `vault write database/rotate-role/<role>`.
   - Update connection strings (referencing the secret, not the value).
   - Rolling-restart consumers; confirm via `pg_stat_activity` that new sessions use new creds.

3. **Verify the old credential is inactive.** Never skip this step.
   - AWS: CloudTrail event search for old access-key-id returning events after the `delete-access-key` call. Must be empty.
   - GitHub: `curl -H "Authorization: token <old-pat>" https://api.github.com/user` → must return 401.
   - Stripe: dashboard → API requests filtered by key → must show 0 successful after revocation.
   - Database: connect with old password → must fail with "authentication failed".

4. **Rewrite git history.** Only after rotation + verification.

   Preferred tool: `git filter-repo`. Build a `replacements.txt`:
   ```
   AKIAIOSFODNN7EXAMPLE==>REDACTED_AWS_ACCESS_KEY
   wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY==>REDACTED_AWS_SECRET_KEY
   ghp_1234567890abcdefghijklmnopqrstuvwxyz==>REDACTED_GITHUB_PAT
   ```

   Run:
   ```bash
   git clone --mirror <repo-url> repo-mirror.git
   cd repo-mirror.git
   git filter-repo --replace-text ../replacements.txt
   git push --force --all
   git push --force --tags
   ```

   Alternative — BFG:
   ```bash
   bfg --replace-text replacements.txt repo-mirror.git
   cd repo-mirror.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force --all
   ```

5. **Notify collaborators.** Anyone with an active clone of the affected branches must reclone or rebase. Send the list of rewritten refs, the rationale (briefly), and the date. Close any open PRs that touch the rewritten branches — they will need to be re-opened against the new history.

6. **Update allowlists — but only for confirmed false positives.** For each finding classified `false-positive`, add a path-scoped entry to `.gitleaksignore`:
   ```
   # SRI hash for external CSS — not a secret
   public/assets/vendor.css:sha384-abcdef…
   ```
   Do not add blanket rules. Do not allowlist a real secret.

7. **Install prevention controls.** Pick whichever the repo does not already have.

   Pre-commit hook (`.pre-commit-config.yaml`):
   ```yaml
   repos:
     - repo: https://github.com/gitleaks/gitleaks
       rev: v8.18.0
       hooks:
         - id: gitleaks
           name: gitleaks-protect
           args: [protect, --staged, --redact, --verbose]
   ```

   CI workflow (`.github/workflows/secret-scan.yml`):
   ```yaml
   name: secret-scan
   on: [pull_request]
   jobs:
     gitleaks:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with: { fetch-depth: 0 }
         - uses: gitleaks/gitleaks-action@v2
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

   Secret manager adoption — if any rotated credential currently lives in a `.env` file checked into the repo, move it:
   ```bash
   aws secretsmanager create-secret --name prod/myapp/stripe-key \
       --secret-string "$(cat stripe.key)"
   rm stripe.key
   # update app to read SecretsManager at startup, not a file
   ```

8. **Write the remediation report.** `security/remediation/secrets-<date>.md` contains per-finding rows with:
   - Finding ID, file, line, classification.
   - Rotation action taken with timestamp and actor.
   - Verification method and evidence (CloudTrail event ID, 401 response, etc.).
   - History-rewrite commit range and the ref names force-pushed.
   - Prevention controls added (pre-commit, CI, secret manager).
   - For false positives: the allowlist entry added and the provenance evidence.

## Examples

### Example 1 — AWS access key in a committed `.env`, 3 months in history

`secrets.json` contains:
```json
{
  "findings": [
    {
      "id": "sec-001",
      "rule": "aws-access-key-id",
      "file": ".env",
      "line": 4,
      "commit": "a1b2c3d",
      "match": "AKIAIOSFODNN7EXAMPLE"
    }
  ]
}
```

Remediation sequence:

```bash
# 1. Rotate
aws iam create-access-key --user-name deploybot
# outputs AKIAI...NEW and wJalrX...NEW. Save to Secrets Manager.
aws secretsmanager put-secret-value --secret-id prod/deploybot/aws \
    --secret-string file://new-creds.json
# 2. Update consumers: ECS task def reads from Secrets Manager ARN
aws ecs update-service --cluster prod --service api --force-new-deployment
# 3. Disable then delete old key
aws iam update-access-key --user-name deploybot \
    --access-key-id AKIAIOSFODNN7EXAMPLE --status Inactive
# wait 10 minutes; confirm no CloudTrail use of old key
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAIOSFODNN7EXAMPLE \
    --start-time "$(date -u -v-10M +%FT%TZ)"
# empty → safe to delete
aws iam delete-access-key --user-name deploybot --access-key-id AKIAIOSFODNN7EXAMPLE

# 4. Rewrite history
cat > replacements.txt <<'EOF'
AKIAIOSFODNN7EXAMPLE==>REDACTED_AWS_ACCESS_KEY
wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY==>REDACTED_AWS_SECRET_KEY
EOF
git clone --mirror git@github.com:acme/api.git
cd api.git && git filter-repo --replace-text ../replacements.txt
git push --force --all && git push --force --tags

# 5. Install pre-commit + CI hook (files above)
# 6. Remove .env from repo: git rm .env; echo ".env" >> .gitignore
```

Report excerpt:
```markdown
### sec-001 — AWS access key, AKIAIOSFODNN7EXAMPLE
- Classification: aws-access-key, HIGH
- Rotation: new key AKIA…9XJR issued 2026-04-20T14:02Z; stored in Secrets Manager `prod/deploybot/aws`.
- Invalidation: old key deleted 2026-04-20T14:18Z. CloudTrail lookup 2026-04-20T14:18Z–14:28Z returned 0 events.
- History rewrite: `git filter-repo` over `main`, `release/*`, 8 tags. Force-pushed 2026-04-20T14:31Z. Collaborators notified in #eng 14:33Z.
- Prevention: `.pre-commit-config.yaml` gitleaks hook added; `.github/workflows/secret-scan.yml` added; `.env` added to `.gitignore`.
```

### Example 2 — false positive, high-entropy CSS asset hash

`secrets.json` contains:
```json
{
  "findings": [
    {
      "id": "sec-007",
      "rule": "generic-high-entropy",
      "file": "public/index.html",
      "line": 12,
      "match": "sha384-abcdef1234567890ghijklmnopqrstuvwxyzABCDEFGHIJ"
    }
  ]
}
```

Triage: context around the match is an `integrity="sha384-…"` attribute on a `<link rel="stylesheet">` tag — this is a Subresource Integrity hash, not a credential.

Validation steps:
- Searched repo for `auth` / `token` / `bearer` references to the value → none.
- Verified the value appears in CDN response headers for the same URL → confirms SRI use.
- Confirmed the scanner rule is `generic-high-entropy`, which is known to flag SRI hashes.

Action:
```yaml
# .gitleaksignore
public/index.html:sha384-abcdef1234567890ghijklmnopqrstuvwxyzABCDEFGHIJ
```

Report excerpt:
```markdown
### sec-007 — false positive: SRI hash
- Classification: false-positive (Subresource Integrity hash).
- Evidence: value appears only in `integrity="…"` attribute of a `<link>` tag referencing `https://cdn.acme.example/vendor.css`. No auth-related usage.
- Action: path+value-scoped allowlist entry added to `.gitleaksignore`. No rotation required.
- Decision by: @tahir, 2026-04-20.
```

## Constraints

- Never rewrite git history before confirming the credential is invalidated at the provider. Rewriting first merely shouts "this was leaked here" without removing the underlying access.
- Never add a blanket `.gitleaksignore` rule (e.g. whole-directory suppress). Only scope to the specific file + value.
- Do not skip the verification step (4). Providers sometimes cache key validity for several minutes; "it doesn't work in my terminal" is not proof.
- Do not force-push without giving collaborators warning. Open PRs against rewritten branches must be closed and reopened against the new HEAD.
- Do not reuse a rotated secret's old name / ID pattern in the new secret. Makes downstream ACL review impossible.

## Quality checks

- The remediation report lists every finding from `secrets.json` with a terminal state (rotated / false-positive / deferred with ticket).
- For every `rotated` finding, the report cites the provider verification evidence (CloudTrail event ID, 401 response body, etc.).
- Re-run `secret-scanner` against the rewritten history → 0 findings for the originally-reported secret values.
- `pre-commit run --all-files` succeeds with the new gitleaks hook installed.
- The CI workflow runs on a test PR that intentionally adds a fake AWS key and is blocked by the gitleaks step.
