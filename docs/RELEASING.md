# Releasing skillskit

This repo produces a tagged release roughly every time a batch of skill changes or CLI improvements is merged. A release is:

- Cross-platform binaries (macOS / Linux / Windows × amd64 / arm64) on GitHub Releases.
- A Homebrew formula pushed to `tahirraufkeeyu/homebrew-tap`.
- A Scoop manifest pushed to `tahirraufkeeyu/scoop-bucket`.
- A rebuild of the static site on skillskit.dev (happens automatically when Amplify sees the new commit).

The whole thing is driven by GoReleaser triggered from a tag. You do not edit the Formula or the Scoop manifest by hand; GoReleaser regenerates both on every release.

## First-time setup

Before the first release ever, do these once.

### 1. Create the homebrew tap repo

```
github.com/tahirraufkeeyu/homebrew-tap   (empty repo)
```

Homebrew requires the repo name to start with `homebrew-`. The tap users install with `brew tap tahirraufkeeyu/tap` (Homebrew strips the `homebrew-` prefix automatically).

### 2. Create the scoop bucket repo

```
github.com/tahirraufkeeyu/scoop-bucket    (empty repo)
```

No naming convention required; the manifest will land in the root of this repo as `skillskit.json`.

### 3. Create a PAT with scoped write access

GitHub settings → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.

- **Resource owner**: `tahirraufkeeyu`
- **Repository access**: Only select repositories → `homebrew-tap` and `scoop-bucket` (the two we just created).
- **Permissions**: Repository → Contents → Read and write.
- **Expiration**: 90 or 180 days. Rotate when it expires; GoReleaser surfaces the 401 clearly in the workflow log.

Copy the token.

### 4. Add the token as a repo secret

On this repo (`software-development-agent-stack--sdas`):

- Settings → Secrets and variables → Actions → New repository secret
- Name: `TAP_GITHUB_TOKEN`
- Value: paste the PAT

The release workflow reads this to push to the two target repos.

### 5. Install GoReleaser locally (optional)

Only needed if you want to run `make release-snapshot` locally before tagging. CI handles real releases.

```bash
brew install goreleaser       # macOS / Linux
# or
go install github.com/goreleaser/goreleaser/v2@latest
```

## Cutting a release

From a clean `main` (or a release branch merged into main):

```bash
# 1. Confirm the build is sane locally.
make build
./bin/skillskit version
make release-snapshot            # produces dist/ with cross-platform binaries

# 2. Bump version + tag.
# Semantic versioning — v0.x.y for pre-1.0, v1.x.y after we declare stable.
git tag v0.1.0
git push origin v0.1.0
```

Pushing the tag triggers `.github/workflows/release.yml`. Within 2–4 minutes:

- A GitHub Release `skillskit v0.1.0` appears with six archives + `checksums.txt`.
- The Homebrew tap repo gets a new commit updating `Formula/skillskit.rb`.
- The Scoop bucket repo gets a new commit updating `skillskit.json`.

Users pick up the new version via:

```bash
brew update && brew upgrade skillskit     # Homebrew
scoop update skillskit                    # Scoop
# or re-run the curl|sh installer for ad-hoc
```

Then `skillskit update` re-syncs installed skills from the new binary's embedded snapshot.

## Version strategy

- **Pre-1.0** (`v0.x.y`): CLI flags and behaviour may change between minor versions. Skill content is stable — semver applies to the CLI, not the skills.
- **1.0.0+**: CLI is stable. Breaking changes require a major bump. Skill additions / non-breaking edits ride minor releases.

When adding a new skill, bump the patch version. When adding a new department or a new CLI flag, minor. When removing or renaming a CLI flag, major.

## Dry-run a release without pushing a tag

On the Actions page, pick **Release skillskit CLI** → **Run workflow** → check **Build a snapshot**. GoReleaser builds the artifacts but doesn't publish them — you can download from the workflow run to verify they work.

## If a release goes wrong

GoReleaser publishes atomically: either the Release + tap + scoop updates all succeed, or the step fails and none of them do. If a post-Release step fails (tap push 401'd etc.):

1. Delete the GitHub Release + tag:
   ```bash
   gh release delete v0.1.0
   git push --delete origin v0.1.0
   git tag -d v0.1.0
   ```
2. Fix the underlying issue (usually token expired — rotate per step 3 above).
3. Re-tag and push.

If a bad release shipped to users (a broken binary, a bad skill), publish a fix patch release (`v0.1.1`) rather than trying to yank the old one. Brew and Scoop users get the fix on their next `brew upgrade` / `scoop update`.

## What's in the release

Each GitHub Release has:

- `skillskit_0.1.0_macOS_x86_64.tar.gz` / `..._arm64.tar.gz`
- `skillskit_0.1.0_linux_x86_64.tar.gz` / `..._arm64.tar.gz`
- `skillskit_0.1.0_windows_x86_64.zip` / `..._arm64.zip`
- `checksums.txt` — SHA256 for every archive. Homebrew/Scoop formulas pin to these.
- Auto-generated release notes from commits since the last tag, grouped by Conventional Commit prefix.

The archives contain the `skillskit` binary (with `.exe` suffix on Windows) plus `LICENSE` and `README.md`.

## Checklist before tagging

- [ ] `make test` passes.
- [ ] `make release-snapshot` produces 6 archives under `dist/`.
- [ ] One or more of the snapshot binaries runs and `skillskit version` prints sane output.
- [ ] `git log main..` shows the commits you expect to include — nothing sneaky pushed by a teammate in the last hour.
- [ ] No uncommitted changes in the working tree.
- [ ] Version number follows the strategy above and is greater than the last tag.
