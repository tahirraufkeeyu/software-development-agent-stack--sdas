---
name: changelog
description: Use when preparing user-facing release notes from git history and PR metadata. Generates a Keep-a-Changelog-format document grouped by semantic version, translating commit jargon into user impact and filtering out internal-only changes.
---

## When to use

Trigger this skill when:

- A release (tag, version bump, deploy) needs user-facing release notes.
- A monthly or quarterly "what shipped" digest is needed for customers, a newsletter, or a developer blog.
- A CHANGELOG.md file needs an update before a merge to main.

Do **not** use this skill for:

- Internal engineering rollups (use `status-update` instead).
- Security advisories — those follow a separate disclosure process.
- Commit-level audit logs — use `git log` directly.

## Inputs

Required:

- **Repository** (local path or GitHub URL).
- **Version range** — either two tags (`v2.3.0..v2.4.0`) or two dates (`2026-03-01..2026-03-31`) or a single tag to compare against the previous tag.
- **Target version** (the version being released, e.g., `v2.4.0`).

Optional:

- **Audience** — `customer` (default), `developer`, or `internal`. Affects filtering and tone.
- **Path to existing CHANGELOG.md** — the skill will prepend the new section rather than overwrite.
- **PR label filters** — if the repo uses labels like `user-facing` or `changelog:skip`, use them.

## Outputs

A Markdown block in Keep a Changelog format, grouped by the following categories (in order):

1. **Added** — new features.
2. **Changed** — changes to existing functionality.
3. **Deprecated** — features marked for removal.
4. **Removed** — features removed in this release.
5. **Fixed** — bug fixes.
6. **Security** — security-impacting changes.

Each bullet is a single sentence describing user impact, not the implementation. Ticket and PR numbers may be suffixed in parentheses.

## Tool dependencies

- **Bash** — `git log`, `git tag`, `git diff --stat` for scoping.
- **GitHub MCP** (strongly recommended) — `list_pull_requests` to pull titles, bodies, labels, and merge status.
- **Read / Grep** — to parse existing CHANGELOG.md and detect the previous version.

## Procedure

1. **Resolve version range.** If the user gave two tags, use them. If one tag, find the previous tag via `git describe --tags --abbrev=0 <tag>^`. If dates, use `--since` and `--until`.
2. **List merged PRs in range.** Prefer GitHub MCP for metadata. For each PR: number, title, body, author, labels.
3. **Filter out non-user-facing PRs.** Drop PRs that are:
   - Labeled `changelog:skip`, `internal`, `chore`, `ci`, `test`, `refactor`, or `docs:internal`.
   - Titled with conventional-commit prefixes `chore:`, `ci:`, `test:`, `refactor:`, `build:`, `style:` (unless the body explicitly says "user-facing").
   - Touching only files under `.github/`, `ci/`, `tests/`, `docs/internal/`.
4. **Categorize remaining PRs.** Use both labels and conventional-commit prefixes:
   - `feat:` or label `feature` → Added.
   - `fix:` or label `bug` → Fixed.
   - `perf:` → Changed (with "Improved" phrasing) unless body says "fixes regression," then Fixed.
   - `security:` or label `security` → Security.
   - `deprecate:` or `remove:` or label `breaking` → Deprecated or Removed (read the body to decide).
   - Title starts with "Change X to Y" / "Update" → Changed.
5. **Translate to user impact.** For each PR, rewrite the title into a user-facing sentence. Examples:
   - `feat(auth): add refresh token rotation` → "Refresh tokens now rotate every 15 minutes, reducing the window in which a leaked token can be used."
   - `fix(billing): off-by-one in proration calculation` → "Fixed a rounding error in mid-cycle plan changes that occasionally charged $0.01 more than expected."
   - `perf(api): memoize feature flag lookups` → "Reduced p99 API latency by ~40ms for accounts with many feature flags."
6. **Deduplicate.** Multiple PRs that ship the same feature should collapse into one bullet.
7. **Order within each section.** Most user-impactful first. If the PR body includes an `Impact:` field, use it to rank.
8. **Write the version header.** `## [<version>] - <YYYY-MM-DD>`. If this is the first release for the project, title the section `## [Unreleased]` and let a human promote it at release time.
9. **Prepend to existing CHANGELOG.md** if one was provided. Do not overwrite.
10. **Return** the draft. Recommend a 5-minute skim by a PM or DevRel before publishing.

## Examples

### Example 1: SaaS product, tagged release, GitHub MCP available

Input: "Generate changelog for v2.4.0. The previous tag is v2.3.0. Prepend to /repo/CHANGELOG.md. Audience is customer."

Output (excerpt):

```
## [2.4.0] - 2026-04-19

### Added
- Single sign-on support for Okta and Azure AD. Admins can configure SSO in Settings → Security (#412).
- CSV export for the Analytics dashboard, up to 1M rows per export (#418).

### Changed
- The Settings page now loads in two panels instead of a single long list, so you can navigate between sections without scrolling (#401).
- API key names now allow emoji and up to 120 characters, up from 40 (#423).
- Improved search relevance: exact-match queries are now returned before partial matches (#430).

### Deprecated
- The `/v1/reports/legacy` endpoint is deprecated and will be removed in v2.6.0 (scheduled 2026-07). Migrate to `/v2/reports` (#426).

### Fixed
- Fixed a rounding error in mid-cycle plan changes that occasionally charged $0.01 more than expected (#409).
- Fixed a bug where the "Invite member" button was disabled for admins of workspaces with more than 100 members (#411).
- Fixed slow loading on the Billing page for accounts with over 1,000 historical invoices (#419).

### Security
- Session cookies are now set with `SameSite=Strict` by default; existing sessions will continue to work until they expire (#428).
```

### Example 2: Developer SDK, no GitHub MCP

Input: user pastes the output of `git log v0.14.0..v0.15.0 --oneline` and says "make a changelog, audience is developer."

Output: same structure, but sourcing is from commit titles only (less rich). The skill should flag which commits it could not categorize with confidence and ask a single clarifying question before finalizing.

## Constraints

- **Keep a Changelog categories only.** Do not invent categories like "Performance" or "UX" — those fit under Changed or Fixed.
- **User impact, not implementation.** "Fixed N+1 query in the orders endpoint" is internal; "Orders page now loads in under 1 second, down from 6 seconds" is user-facing.
- **Filter aggressively.** A changelog with 80 bullets is worse than one with 12. Only ship what the reader will care about.
- **Link PR or ticket numbers** at the end of each bullet in parentheses.
- **Breaking changes are called out explicitly** in Changed or Removed, with a "This is a breaking change" prefix and a migration hint.
- **Do not invent release dates.** The date is the date the tag was created, or today if the release is happening today.
- **Deprecations need a target removal version and date.**
- **Security items** should describe the class of issue, not a full exploit — avoid aiding anyone still running a vulnerable version.

## Quality checks

Before returning, verify:

- [ ] Version header uses `[version] - YYYY-MM-DD` format.
- [ ] Sections appear in order: Added, Changed, Deprecated, Removed, Fixed, Security. Empty sections omitted.
- [ ] Every bullet describes user impact, not implementation.
- [ ] Every bullet has a PR or ticket reference.
- [ ] No bullets for `chore:`, `ci:`, `test:`, `refactor:` unless labeled user-facing explicitly.
- [ ] Breaking changes are flagged and include migration guidance.
- [ ] Deprecations include a removal version and date.
- [ ] If a CHANGELOG.md already exists, the new section is prepended without corrupting prior sections.
