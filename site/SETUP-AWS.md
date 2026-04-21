# AWS Amplify Hosting setup (one-time)

The site deploys to AWS Amplify Hosting — Amazon's equivalent of Vercel / Netlify / Azure Static Web Apps. Amplify connects to this GitHub repo, builds on every push to `main`, publishes a unique preview URL for each pull request, manages the SSL cert, and serves from a global CDN.

The build spec lives in [`amplify.yml`](../amplify.yml) at the repo root. This doc walks the human steps to set the hosting up once.

## Prerequisites

- An AWS account with permissions to create Amplify apps (or full admin for simplicity).
- Owner or maintainer access on `tahirraufkeeyu/software-development-agent-stack--sdas`.
- The domain `skillskit.dev` registered at your registrar of choice (any works — Cloudflare Registrar, Route 53, Namecheap).

## Steps

### 1. Create the Amplify Hosting app

In the [AWS Console](https://console.aws.amazon.com/):

1. Open **AWS Amplify** → **Hosting** → **Create new app**.
2. Pick **Host a web app** (not "Build a full-stack app" — we don't use Amplify's backend features).
3. Choose **GitHub** as the source and click **Authorize**. On first use, AWS walks you through GitHub's OAuth to grant repo access.
4. **Repository**: `tahirraufkeeyu/software-development-agent-stack--sdas`.
5. **Branch**: `main`.
6. Leave monorepo / root-directory settings alone for now — the `amplify.yml` in the repo root handles app-root routing (`appRoot: site`).
7. **App name**: `skillskit-site`.
8. **Build image**: **Amplify managed** (Node 20 or later). Amplify picks this by default.
9. **Build settings**: Amplify will auto-detect the `amplify.yml` in the repo. Confirm the detected spec matches — you should see `appRoot: site`, `baseDirectory: dist`, and the npm ci / npm run build commands.
10. **Advanced settings**:
    - **Live package updates**: leave off.
    - **Environment variables**: none required for Phase B1. (The customizer's OpenRouter calls are browser-side; no server-side keys.)
11. **Review** → **Save and deploy**.

Amplify provisions the app and kicks off the first build in ~1 minute. First builds take 2–4 minutes; cached rebuilds are ~30 s.

### 2. Enable pull-request previews

Previews aren't on by default.

1. In the Amplify app console, go to **App settings** → **Previews**.
2. Toggle **Enable pull request previews** on.
3. Scope: **For pull requests targeting `main`**.

Amplify installs a GitHub check that, on every PR open / sync, builds the PR branch and comments a preview URL on the PR. Closing / merging the PR tears it down automatically.

Previews count against the Amplify monthly free-tier minutes (1000 build minutes); PR throughput on this repo fits easily.

### 3. Add the custom domain

Once the default `main.<app-id>.amplifyapp.com` URL works:

1. Amplify app console → **Hosting** → **Custom domains** → **Add domain**.
2. Enter `skillskit.dev`.
3. Amplify asks whether your DNS is managed by Route 53 or elsewhere:
   - **Route 53**: Amplify can auto-create the records. Select Route 53 and confirm.
   - **External DNS (Cloudflare, Namecheap, etc.)**: Amplify shows you a set of `CNAME` records to add at your DNS host:
     - `_<random>.<random>.acm-validations.aws` → validation (ACM cert)
     - `<your-subdomain>` → `<amplify-distribution>.cloudfront.net`
     - Plus a separate record for `www.skillskit.dev` if you want both.
4. Add the records at your DNS provider.
5. For **apex** `skillskit.dev`: you need an `ALIAS` or `ANAME` record (plain `CNAME` at apex is not valid DNS). Cloudflare Registrar supports CNAME flattening (apex CNAMEs work as if they were ALIAS). Namecheap does not — if you use Namecheap, host DNS at Cloudflare and leave the registrar as Namecheap, OR use Route 53 as the DNS host.
6. Back in the Amplify console, click **Verify**. Cert issuance takes 5–30 minutes after DNS propagation. Once verified, Amplify issues an ACM cert automatically.
7. Propagation can take up to an hour globally. Test with `curl -I https://skillskit.dev` once it's live.

### 4. Verify

```bash
# Default URL (assigned by Amplify on first deploy)
curl -I https://main.<app-id>.amplifyapp.com

# Custom domain, once DNS + cert are live
curl -I https://skillskit.dev
```

Both should return `200 OK` with content-type `text/html` and a `server: AmazonS3` / CloudFront header.

## What happens on every push

- **Push to `main`** → Amplify builds and deploys to production (`https://skillskit.dev`).
- **Pull request opened or updated** → Amplify builds a preview and comments the URL on the PR (e.g. `https://pr-42.<app-id>.amplifyapp.com`).
- **PR merged or closed** → preview is automatically torn down.

Amplify also publishes build-status checks (pass / fail) to GitHub, so the PR page shows red when the build breaks.

## Environment variables

For Phase B1 (LLM customizer) the site doesn't need any. Every API call to OpenRouter happens in the user's browser with their own key — our hosting never sees it.

If future phases add backend features (e.g. a skill-validator Lambda or analytics), set env vars in **App settings** → **Environment variables**. Amplify exposes them to the build container at build time and to any backend runtime.

## Cost

Amplify Hosting Free tier:

- **Build minutes**: 1000 per month. Our build is ~45 s → ~1300 builds/month fit.
- **Served requests**: 15 GB outbound data per month. At ~200 KB / page view, that's ~75k page views before spillover.
- **Stored assets**: 5 GB. The built site is <10 MB.
- **SSL cert**: ACM is free through Amplify for verified domains.

If traffic exceeds free tier (unlikely for a docs site):
- Additional build minutes: $0.01 / minute.
- Additional outbound data: $0.15 / GB.

A site doing 200k unique visitors/month still costs under $20/month.

## Alternative: S3 + CloudFront (power-user path)

If you prefer more control or cheaper at-scale serving:

1. S3 bucket with `public-read` configured for website hosting.
2. CloudFront distribution fronting the bucket.
3. ACM cert (us-east-1) for CloudFront to serve on your custom domain.
4. Route 53 or external DNS pointing at CloudFront.
5. GitHub Actions workflow (`aws-actions/configure-aws-credentials` + `aws s3 sync` + `aws cloudfront create-invalidation`) that deploys on push to main.

This drops you below $1/month for typical traffic but requires Terraform/IaC knowledge to keep sane. Open a separate issue if you want that path — we'd add a `.github/workflows/aws-s3-deploy.yml` and replace `amplify.yml` with a `terraform/` directory.

## Troubleshooting

**Build fails with `npm ci` lockfile mismatch.**
Ran `npm install` locally without committing the updated `package-lock.json`. Fix by running `npm ci` locally to verify, then committing the lockfile.

**Custom domain stuck at "Pending verification".**
DNS hasn't propagated yet. Wait ~30 min. If still stuck after an hour, check the ACM cert validation record actually exists at your DNS host (common typo: the `_<random>` prefix gets truncated in some registrar UIs).

**Preview URLs aren't generated on PRs.**
Previews weren't enabled at step 2. Turn them on; they apply to any future PR (not retroactive).

**Build succeeds but `/skills/foo` returns 404 on the custom domain.**
Amplify may not be configured for SPA / clean URLs. Astro generates static HTML pages for every route with `build.format: 'directory'`, so each URL has a corresponding `index.html` — no special rewrite rules needed. If 404s persist, check Amplify's **Rewrites and redirects** panel; it should be empty (no rules).

**Old deploys pile up in the console.**
Amplify keeps build history but doesn't bill for past builds, only build minutes at build time. Safe to ignore. Optionally clean up in **App settings** → **General** → **Disconnect app** if you re-provision.

## Rollback

Every successful build is kept in **Hosting** → **Deployments**. To revert:

1. Open the deploy history for the `main` branch.
2. Find the last known-good build.
3. Click **Redeploy this version**.

Amplify re-serves that artifact within seconds — no rebuild needed. Pair this with a revert commit so your `main` matches the served artifact.
