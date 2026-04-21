# Azure Static Web Apps setup (one-time)

The GitHub Actions workflow at `.github/workflows/azure-static-web-apps.yml` deploys the site on every push to `main` and creates preview URLs for pull requests. It requires a deploy token issued by Azure. Follow these steps once to provision the Azure resource and wire the token up.

## Prerequisites

- An Azure subscription (free trial or pay-as-you-go).
- Owner or Contributor access to the subscription.
- Ability to set repository secrets on `tahirraufkeeyu/software-development-agent-stack--sdas`.

## Steps

### 1. Create the Static Web App resource

In the [Azure portal](https://portal.azure.com):

1. **Create a resource** → search "Static Web App" → **Create**.
2. **Subscription**: your subscription.
3. **Resource group**: create new, name it `rg-skillskit` (or reuse an existing one).
4. **Name**: `skillskit-site`.
5. **Plan type**: **Free**.
6. **Region for Azure Functions and staging environments**: pick the region closest to your primary audience (`West Europe` or `East US 2` are safe defaults).
7. **Deployment details**:
   - Source: **GitHub**.
   - Click **Sign in with GitHub** and authenticate the account that owns the repo.
   - Organization: `tahirraufkeeyu`.
   - Repository: `software-development-agent-stack--sdas`.
   - Branch: `main`.
8. **Build details**:
   - Build presets: **Custom**.
   - App location: `/site`.
   - API location: *(leave blank)*.
   - Output location: `dist`.
9. **Advanced** tab: leave defaults; enable deployment authentication if you want preview URLs to be login-gated (optional, not recommended for a public catalog).
10. **Review + Create** → **Create**.

Azure provisions the resource in ~1 minute and automatically injects a workflow file into the repo named `.github/workflows/azure-static-web-apps-<random-name>.yml`.

### 2. Replace the auto-generated workflow with the one in this repo

Azure's auto-generated workflow assumes app root is the repo root. Ours already lives at `site/`, and the workflow in this repo (`azure-static-web-apps.yml`) is configured for that layout plus path-filtering (only rebuild when `site/` or `departments/**/SKILL.md` changes) and preview-URL lifecycle on PR close.

Delete the auto-generated file and keep ours:

```bash
git rm .github/workflows/azure-static-web-apps-<random-name>.yml
git commit -m "chore(ci): remove Azure auto-generated workflow; use custom one"
git push
```

### 3. Confirm the secret name matches

When Azure created the Static Web App, it added a repo secret like:

```
AZURE_STATIC_WEB_APPS_API_TOKEN_<ADJECTIVE>_<NOUN>_<RANDOM>
```

Our workflow references `AZURE_STATIC_WEB_APPS_API_TOKEN_SKILLSKIT`. Pick one of:

**Option A — rename the secret in GitHub.**

1. Repo → Settings → Secrets and variables → Actions.
2. Copy the value of the Azure-created secret.
3. Create a new secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_SKILLSKIT` with the copied value.
4. Delete the Azure-created one.

**Option B — edit the workflow.**

Open `.github/workflows/azure-static-web-apps.yml` and update both occurrences of `AZURE_STATIC_WEB_APPS_API_TOKEN_SKILLSKIT` to match the Azure-created secret name.

Option A keeps the workflow readable and stable across re-provisioning.

### 4. Trigger the first deploy

Push any change to `main` (or merge the current PR). The workflow runs in GitHub Actions, builds the site, and deploys to the Azure endpoint. The default URL looks like:

```
https://<random-words>.azurestaticapps.net
```

Visit that URL to confirm the site is live.

### 5. Add the custom domain

Once the default deploy works:

1. Azure portal → your Static Web App → **Custom domains** → **Add**.
2. Domain type: **Custom domain on other DNS**.
3. Enter `skillskit.dev`.
4. Azure shows you:
   - A `TXT` record for validation.
   - A `CNAME` or `ALIAS` target for the actual traffic.
5. At your DNS provider (Cloudflare Registrar, Namecheap, Azure DNS, etc.) add those records. For apex `skillskit.dev` you may need:
   - `ALIAS`/`ANAME` record at `@` (root) pointing to the Azure target. Cloudflare Registrar supports apex flattening; Namecheap does not for `ALIAS` — use Cloudflare as DNS host even if you bought the domain elsewhere.
6. Azure re-checks every few minutes. Takes 10–60 minutes for DNS to propagate globally. Once validated, Azure issues a Let's Encrypt cert automatically.
7. Repeat the process for `www.skillskit.dev` pointing to the same target if you want both hostnames.

### 6. Verify

```bash
curl -I https://skillskit.dev
# expect: 200, content-type: text/html, server includes Azure signature
```

The site is now served at `https://skillskit.dev` with automatic HTTPS and global CDN.

## What happens on every push

- **Push to `main`** → workflow builds, uploads to Azure, deploys to production URL (`https://skillskit.dev`).
- **Pull request** → workflow builds, uploads to Azure, deploys to a unique `https://<pr>.<swa>.azurestaticapps.net` preview URL. Azure comments the URL on the PR.
- **PR closed** → workflow tears down the preview environment.

Preview environments count against your Free tier limit (10 staging environments by default). Old PRs that never closed may pin environments — the `close_pr_preview` job in the workflow handles this automatically on PR close.

## Cost

Azure Static Web Apps Free tier at our usage pattern:

- 100 GB bandwidth / month — well under even a viral launch.
- 0.5 GB app storage — the built site is <5 MB.
- 2 custom domains — `skillskit.dev` + `www.skillskit.dev` fit.
- 10 staging environments — typical PR throughput.

If traffic ever exceeds the Free tier (unlikely for a docs site), upgrade to Standard ($9/month). No code changes required.

## Troubleshooting

**Workflow fails at "Deploy to Azure Static Web Apps" with `401 Unauthorized`.**
The secret name in the workflow doesn't match the secret in GitHub. Check step 3 above.

**Workflow passes but `skillskit.dev` shows an Azure 404.**
Custom-domain validation not complete yet. Check the Custom Domains pane in the portal; usually resolves within an hour of DNS propagation.

**Preview URLs aren't posted on PRs.**
The workflow needs `pull-requests: write` permission (already set in the `permissions` block). Confirm the repo's Actions permission setting isn't overriding it at the org level.

**Stale preview environments accumulate.**
Old closed PRs that were closed before this workflow existed won't have triggered the `close_pr_preview` job. Clean up manually in the portal's staging environments pane.

## Rollback

Azure keeps the previous successful deploy available. In the portal:

**Environments** → select the prior deploy → **Swap** to promote it back to production.

Alternatively, revert the offending commit and push; the next deploy replaces the bad one.
