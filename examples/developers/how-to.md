# Developers — full end-to-end walkthrough

**What this shows:** adding a new feature to a real public repo using nine SDAS skills end-to-end — from first clone to merged PR to deploy. You'll see how each skill auto-triggers, what it actually produces, and how the orchestrator ties them together at the end.

**Target repo:** [hagopj13/node-express-boilerplate](https://github.com/hagopj13/node-express-boilerplate) — a popular (~7.6k ⭐), well-maintained Node/Express/Mongoose boilerplate with Users, Auth, RBAC, Jest tests. Small enough to comprehend, realistic enough that the demo feels like real work.

**Feature we're adding:** a **Bookmarks** feature — authenticated users can save URLs with a title, list them, and delete them. New endpoints:
- `POST /v1/bookmarks`
- `GET /v1/bookmarks`
- `DELETE /v1/bookmarks/:bookmarkId`

**Skills exercised (in order):**

| # | Skill | Role in this flow |
|---|---|---|
| 1 | `code-review` | Orient ourselves — read the existing User + Auth modules to match the project's style |
| 2 | `api-design` | Design the Bookmarks endpoints as an OpenAPI fragment |
| 3 | `debug` | Diagnose a Jest failure that surfaces during implementation |
| 4 | `test-writer` | Generate Jest tests matching the project's existing test patterns |
| 5 | `code-review` | Self-review the full diff before committing |
| 6 | `refactor` | Apply one small refactoring the review surfaced |
| 7 | `commit-message` | Write the Conventional Commit message |
| 8 | `ship-feature` (orchestrator) | Chain test-writer → code-review → commit-message one more time as regression |
| 9 | `documentation` | Update `README.md` and add an ADR for the design decision |

**Total time:** ~45 minutes if you follow along hands-on, ~15 minutes if you just read.

---

## Pre-flight

Install the `skillskit` CLI (once), then pull in the developer skills:

```bash
# macOS / Linux
brew install tahirraufkeeyu/tap/skillskit

# Windows (PowerShell)
scoop bucket add skillskit https://github.com/tahirraufkeeyu/scoop-bucket
scoop install skillskit

# Then install the developer skills
skillskit install developers
```

That copies the 9 developer skills into `~/.claude/skills/`. No package manager? Use `curl -fsSL https://skillskit.dev/install | sh` instead.

Clone the target repo and open Claude Code in it:

```bash
cd ~/src
git clone https://github.com/hagopj13/node-express-boilerplate.git
cd node-express-boilerplate
cp .env.example .env
# edit .env: set MONGODB_URL (local Mongo) and JWT_SECRET
yarn install
claude
```

Claude Code starts and auto-loads every SKILL.md in `~/.claude/skills/`. No configuration — the `description` field on each skill tells Claude when to invoke it.

---

## Step 1 — orient ourselves in the existing code

**User asks:**

> "Before I add a new feature here, give me a quick review of the User and Auth modules so I understand the conventions this project uses. Focus on the service/controller/validation layering and how errors bubble up."

**Skill matched:** `code-review`
Trigger: the description starts *"Use when a user asks for a review of a diff, pull request, patch, or staged changes."* Claude broadened the match because the user explicitly asked for a structured review of existing files — the same output format (severity-labelled findings, structured summary) fits.

**What Claude did:**

1. `ls src/` — mapped the top-level layout (config, controllers, middlewares, models, routes, services, utils, validations).
2. `cat src/routes/v1/auth.route.js src/controllers/auth.controller.js src/services/auth.service.js src/validations/auth.validation.js` — read one full feature end-to-end as the reference pattern.
3. `cat src/routes/v1/user.route.js src/controllers/user.controller.js src/services/user.service.js` — confirmed the same layering on a CRUD module.
4. Produced a review-style summary covering: layering convention, validation library in use, error-handling pattern, authorisation pattern, test pattern.

**Files changed:** none — `code-review` has `safety: safe`, it only reads.

**Output (excerpt):**

```
Convention observed:
  route  → joi validation (via validate() middleware) → controller → service → mongoose model
  Errors thrown as ApiError(httpStatus, message); caught by src/middlewares/error.js
  Auth: req.user populated by passport JWT strategy; role-gate via auth('<permission>')
  Permissions defined in src/config/roles.js as rolePermissions map

Test convention observed:
  tests/integration/*.test.js uses supertest + in-memory-mongo
  Fixtures in tests/fixtures/ — user.fixture.js seeds userOne, userTwo, admin
  Jest expectations group expected request + response shapes; 401 / 403 cases always covered

Recommended for your new feature: follow the same 5-layer pattern, add a
bookmark.fixture.js, and cover both the owner and non-owner cases in tests.
```

**Why this skill:** `code-review` fits because the user wanted a *structured assessment* of existing code, not just "explain this file." The checklist and severity framing it produces generalise beyond diffs.

---

## Step 2 — design the Bookmarks API

**User asks:**

> "Design the Bookmarks endpoints. Authenticated users should be able to create, list, and delete their own bookmarks. Give me an OpenAPI 3.1 fragment I can drop into the existing spec."

**Skill matched:** `api-design`
Trigger: description is *"Use when designing REST or GraphQL endpoints… emits an OpenAPI 3.1 spec fragment."* Match is unambiguous.

**What Claude did:**

1. Asked about ownership model (per-user bookmarks, no sharing) and about idempotency for `POST` (decided: no — clients can `POST` the same URL twice to get two rows, duplicate-URL constraint is a later product decision).
2. Referenced the project's existing error envelope (observed in Step 1) so the new endpoints return the same shape.
3. Generated a self-contained OpenAPI 3.1 `paths:` fragment plus a `components/schemas` entry for `Bookmark` and `BookmarkCreate`.
4. Added pagination on the list endpoint using `limit` / `page` to match the existing `GET /v1/users` pattern.

**Files changed:**

```
openapi/bookmarks.yaml  (new, 88 lines)
```

**Output (excerpt):**

```yaml
paths:
  /v1/bookmarks:
    post:
      summary: Create a bookmark for the authenticated user
      tags: [Bookmarks]
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BookmarkCreate' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Bookmark' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
    get:
      summary: List the authenticated user's bookmarks
      parameters:
        - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
        - { name: page,  in: query, schema: { type: integer, default: 1,  minimum: 1 } }
      ...
components:
  schemas:
    Bookmark:
      type: object
      required: [id, url, title, createdAt]
      properties:
        id:        { type: string, format: objectid }
        url:       { type: string, format: uri }
        title:     { type: string, minLength: 1, maxLength: 280 }
        createdAt: { type: string, format: date-time }
    BookmarkCreate:
      type: object
      required: [url, title]
      properties:
        url:   { type: string, format: uri }
        title: { type: string, minLength: 1, maxLength: 280 }
```

**Why this skill:** It produces a spec fragment an engineer can implement against, not prose. It also asked 2 clarifying questions (ownership, idempotency) instead of guessing — the `Inputs` section of `api-design` lists exactly those.

---

## Step 3 — implement, hit a bug, debug it

The user implements the `bookmark.model.js`, `bookmark.service.js`, `bookmark.controller.js`, `bookmark.validation.js`, and `bookmark.route.js` following the pattern from Step 1. This is hand-written code — no skill does this part autonomously (deliberate; the skills support the work, they don't replace the judgment).

When the user runs `yarn test` an integration test fails:

```
FAIL  tests/integration/bookmark.test.js
  ● POST /v1/bookmarks › should return 401 when no access token provided
    expect(received).toBe(expected) // Object.is equality
    Expected: 401
    Received: 201
```

The endpoint is creating bookmarks even without auth. That's a bug.

**User asks:**

> "My test says POST /v1/bookmarks is returning 201 when no auth header is set — it should be 401. Debug this."

**Skill matched:** `debug`
Trigger: description mentions *"Reproduce, isolate (bisect), hypothesize, verify, fix, and add a regression test."*

**What Claude did:**

1. Reproduced the failure: ran the single failing test with `yarn test bookmark.test.js --testNamePattern "401"`.
2. Inspected `src/routes/v1/bookmark.route.js`:

    ```js
    router.post('/', validate(bookmarkValidation.createBookmark), bookmarkController.createBookmark);
    ```

3. Compared against `user.route.js` (the convention):

    ```js
    router.post('/', auth('manageUsers'), validate(userValidation.createUser), userController.createUser);
    ```

4. **Isolated the bug:** the new route is missing `auth('manageBookmarks')` middleware. Because there's no gate, the request never even tries to read `req.user`; it goes straight to the service which creates a bookmark with a hard-coded default user ID (a placeholder the user had left in).
5. Hypothesised fix: add `auth('manageBookmarks')` middleware, remove the hard-coded user ID default, register the new permission in `src/config/roles.js`.
6. Verified: ran the test again after the fix — 401 on unauthenticated, 201 on authenticated. Both pass.

**Files changed:**

```
src/routes/v1/bookmark.route.js   (+4 / -2)
src/services/bookmark.service.js  (+0 / -3)   # removed hard-coded default
src/config/roles.js               (+2 / -0)   # added manageBookmarks permission
```

**Output (excerpt):**

```
Hypothesis: missing auth('manageBookmarks') middleware on POST /v1/bookmarks.
Evidence:
  - user.route.js (reference pattern) gates POST with auth('manageUsers')
  - bookmark.route.js has no auth middleware on any route
  - without auth, req.user is undefined; bookmark.service.js had a
    "defaultUserId" fallback that silently created rows

Fix:
  - Add auth('manageBookmarks') on POST, GET, DELETE routes
  - Remove defaultUserId fallback in bookmark.service.js (caller must be authenticated)
  - Add 'manageBookmarks' permission to user role in roles.js

Regression test: the failing 401 test IS the regression test. Keeping it.
```

**Why this skill:** `debug` doesn't just patch the symptom. It walks reproduce → isolate → hypothesise → verify → regression-test. In this case the "regression test" was the user's already-failing test; the skill's procedure doesn't force Claude to write a new test when a valid one already exists.

---

## Step 4 — generate tests for the happy paths

The 401 test was copied from `user.test.js` as a template. We still need positive-path tests: create, list, delete, and a cross-user IDOR test.

**User asks:**

> "Write Jest integration tests for the rest of the bookmark endpoints. Match the pattern from user.test.js. Include an IDOR test — user A should not be able to delete user B's bookmark."

**Skill matched:** `test-writer`
Trigger: description is *"Infer existing test conventions from the repo, then generate AAA-style tests for a target file or function."*

**What Claude did:**

1. Read `tests/integration/user.test.js` and `tests/fixtures/user.fixture.js` to infer the convention.
2. Noted: fixtures are seeded, supertest is the HTTP client, in-memory Mongo resets per describe-block, both success and negative (401 / 403) cases are always tested.
3. Generated `tests/fixtures/bookmark.fixture.js` with two bookmarks — one owned by `userOne`, one owned by `userTwo`.
4. Generated `tests/integration/bookmark.test.js` with 9 test cases.
5. Ran the tests: 8 green, 1 red.
6. Fixed the one red: it was an off-by-one in the `createdAt` assertion (tolerance needed for test clock drift). Updated the assertion.

**Files changed:**

```
tests/fixtures/bookmark.fixture.js    (new, 24 lines)
tests/integration/bookmark.test.js    (new, 172 lines)
```

**Output (excerpt):**

```javascript
// tests/integration/bookmark.test.js — excerpt
describe('DELETE /v1/bookmarks/:bookmarkId', () => {
  beforeEach(async () => {
    await insertUsers([userOne, userTwo]);
    await insertBookmarks([bookmarkOne, bookmarkTwo]); // owned by userOne and userTwo respectively
  });

  test('should return 204 if user deletes their own bookmark', async () => {
    await request(app)
      .delete(`/v1/bookmarks/${bookmarkOne._id}`)
      .set('Authorization', `Bearer ${userOneAccessToken}`)
      .send()
      .expect(httpStatus.NO_CONTENT);

    const deleted = await Bookmark.findById(bookmarkOne._id);
    expect(deleted).toBeNull();
  });

  test('should return 404 if user tries to delete another user\'s bookmark (IDOR)', async () => {
    // userTwo owns bookmarkTwo. userOne tries to delete it — must NOT succeed.
    await request(app)
      .delete(`/v1/bookmarks/${bookmarkTwo._id}`)
      .set('Authorization', `Bearer ${userOneAccessToken}`)
      .send()
      .expect(httpStatus.NOT_FOUND);    // 404 not 403 — don't leak existence
  });
});
```

**Why this skill:** It *inferred* the convention from existing tests rather than writing generic Jest. The IDOR test returning 404 (not 403) is the exact pattern user.test.js uses — the skill picked it up because its procedure step 1 is "read existing tests to learn the repo's conventions."

---

## Step 5 — self-review the full diff

Before committing, run a review on everything staged.

**User asks:**

> "Review the full diff before I commit. Focus on security, correctness, performance, and consistency with the rest of the codebase."

**Skill matched:** `code-review`

**What Claude did:**

1. `git diff --staged` to see every change.
2. Walked the diff against its structured checklist.
3. Produced a severity-labelled findings list with concrete fix suggestions + file:line references.

**Files changed:** none.

**Output (excerpt):**

```
SECURITY (High)
  none found.

SECURITY (Medium)
  src/services/bookmark.service.js:34
    URL is accepted as-is without a protocol check. Malicious values like
    javascript:alert(1) or file:// are rejected by Joi's uri validator, but
    server-side it's worth an allow-list (http / https only). Consider:
      Joi.string().uri({ scheme: ['http', 'https'] })

PERFORMANCE (Low)
  src/services/bookmark.service.js:58 (queryBookmarks)
    Missing index on { userId, createdAt }. List endpoint sorts by createdAt
    desc and filters by userId — will scan the collection without it. Add to
    bookmark.model.js:
      bookmarkSchema.index({ userId: 1, createdAt: -1 });

CONSISTENCY (Low)
  src/controllers/bookmark.controller.js:21
    Uses res.status(201).send(bookmark). Rest of codebase uses res.status(201).send(bookmark.toJSON())
    for explicit serialisation. Not a bug, but inconsistent.

CORRECTNESS
  clean.

TESTS
  clean, 9 cases covering happy path + 401 + 403/404 IDOR. Good.
```

**Why this skill:** Same skill as Step 1, different mode — pointed at a staged diff rather than existing files. The output format is identical so the user knows what to expect.

---

## Step 6 — apply the refactor the review surfaced

The Medium-severity finding (URL scheme allowlist) is worth fixing before merge.

**User asks:**

> "Apply the scheme allowlist fix the review flagged. Also add the index the review suggested."

**Skill matched:** `refactor`
Trigger: description is *"Small-step Fowler-style refactoring with test verification between every change."* Both changes are small and safe.

**What Claude did:**

1. Ran `yarn test` — 9 green (baseline).
2. Change 1: updated `bookmark.validation.js` to add the scheme allowlist. Re-ran tests. 9 green.
3. Change 2: added the compound index in `bookmark.model.js`. Re-ran tests. 9 green.
4. Confirmed no behaviour regression.

**Files changed:**

```
src/validations/bookmark.validation.js  (+1 / -1)
src/models/bookmark.model.js            (+2 / -0)
```

**Why this skill:** Each change is gated by a green test run. If any change had turned red, the skill's procedure would halt and report rather than pushing forward.

---

## Step 7 — write the commit message

**User asks:**

> "Write the commit message."

**Skill matched:** `commit-message`
Trigger: description is *"Write Conventional Commits subject/body/footer from a staged diff."*

**What Claude did:**

1. Ran `git diff --staged --stat` and `git diff --staged` to see scope.
2. Classified: new feature (Bookmarks). Type: `feat`. Scope: `bookmarks`.
3. Wrote subject (≤72 chars) + body (why, not what) + footer.

**Output (excerpt):**

```
feat(bookmarks): add CRUD endpoints for authenticated user bookmarks

POST /v1/bookmarks creates a bookmark (url + title); GET /v1/bookmarks
lists the authenticated user's bookmarks with pagination; DELETE
/v1/bookmarks/:bookmarkId removes one.

Bookmarks are strictly per-user. A user cannot read or modify another
user's bookmarks — IDOR cases return 404 to avoid leaking existence.

Tests cover the happy path, unauthenticated access (401), cross-user
access (404 IDOR), and a compound index on { userId, createdAt } keeps
the list endpoint fast.

Closes #142
```

**Why this skill:** Emits a Conventional-Commits-compliant subject, an imperative-mood body focused on *why*, and the correct footer. Does not commit — that's a separate deliberate user action.

---

## Step 8 — ship the feature (orchestrator)

Individual skills are useful for ad-hoc work. The orchestrator exists for when you want the whole pre-commit gate as one step. Let's run it against a small follow-up tweak the reviewer will probably ask for (e.g. renaming `BookmarkCreate` to `CreateBookmarkInput` for naming consistency).

**User asks:**

> "I just renamed BookmarkCreate to CreateBookmarkInput throughout. Use the ship-feature orchestrator to verify and get me commit-ready."

**Skill matched:** `ship-feature`
Trigger: description is *"Use when a developer has written code for a single feature and wants a full pre-commit gate."* This is exactly that.

**What Claude did:**

1. Chained `test-writer` — checked that existing tests still pass; no new tests needed for a pure rename.
2. Chained `code-review` — reviewed the rename diff. No High-severity findings. All mechanical changes.
3. Chained `commit-message` — drafted:
   ```
   refactor(bookmarks): rename BookmarkCreate → CreateBookmarkInput for consistency
   ```
4. Wrote `.sdas/artifacts/developers/ship-feature-report.md` summarising the run.

**Files changed:**

```
.sdas/artifacts/developers/ship-feature-report.md  (new)
```

**Output (excerpt):**

```markdown
# ship-feature report — 2026-04-20

## Chained skills
1. test-writer      — 9 existing tests; no new tests needed for pure rename
2. code-review      — 0 high, 0 medium findings; mechanical rename
3. commit-message   — proposed:
   refactor(bookmarks): rename BookmarkCreate → CreateBookmarkInput for consistency

## Verdict
Ready to commit.
```

**Why this skill:** the orchestrator chains the three skills and halts if any step finds a blocker (e.g. tests fail, review returns High-severity). In this case everything passed, so it emits a verdict and the proposed commit message.

---

## Step 9 — update documentation

**User asks:**

> "Update the README to mention the Bookmarks endpoints, and write an ADR for the decision to return 404 (not 403) on cross-user access."

**Skill matched:** `documentation`
Trigger: description is *"Generate README, API docs, ADR, or changelog from code and git history."*

**What Claude did:**

1. Edited `README.md`'s "Features" and "API Endpoints" sections to list the three new endpoints.
2. Created `docs/adr/0012-idor-return-404-not-403.md` using the project's existing ADR template (detected in `docs/adr/`).
3. Updated `CHANGELOG.md` with a `### Added — bookmarks` entry.

**Files changed:**

```
README.md                                   (+7 / -0)
docs/adr/0012-idor-return-404-not-403.md    (new, 46 lines)
CHANGELOG.md                                (+3 / -0)
```

**Output (excerpt):**

```markdown
# ADR-0012: Return 404 (not 403) on cross-user resource access

## Context
User A requests GET /v1/bookmarks/<id-owned-by-user-B>. Two options:
  - 403 Forbidden: tells the client the resource exists but they cannot access it.
  - 404 Not Found: tells the client the resource does not exist as far as they can see.

## Decision
Return 404.

## Consequences
- Does not leak existence of other users' resources to enumeration attacks.
- Slightly harder to debug legitimate permission issues (a missing resource
  and a permission miss look identical). Acceptable trade-off given the user
  base has no role-sharing feature.
- All IDOR tests assert 404.
```

**Why this skill:** It read the project's existing ADR format (by scanning `docs/adr/`) and produced an ADR that matches. Generic "write an ADR" would have produced a template; this produced one that belongs in this repo.

---

## Wrap-up — what actually shipped

After 9 skills, the diff looks like this:

```
src/routes/v1/bookmark.route.js              (new)
src/controllers/bookmark.controller.js       (new)
src/services/bookmark.service.js             (new)
src/models/bookmark.model.js                 (new)
src/validations/bookmark.validation.js       (new)
src/config/roles.js                          (modified)
tests/integration/bookmark.test.js           (new, 9 tests)
tests/fixtures/bookmark.fixture.js           (new)
openapi/bookmarks.yaml                       (new)
README.md                                    (+7 lines)
docs/adr/0012-idor-return-404-not-403.md     (new)
CHANGELOG.md                                 (+3 lines)
```

Two commits (one for the feature, one for the rename refactor). PR open. CI green.

## Skills that did NOT trigger (and why)

Worth noting what the kit deliberately did not pull in:

- `project-bootstrap` — not a new project.
- `api-test-generator` (QA) — the project uses Jest integration tests, not property-based API tests from an OpenAPI spec. `test-writer` was the right fit.
- `deploy` — we stopped at merged PR; deploying boilerplate to prod wasn't the scenario.
- `full-security-audit` (security) — for a feature this small, the individual review in Step 5 covered security. For larger changes or a release cycle, `full-security-audit` would be the move.

Selective triggering (skills only activating when the description matches the user's request) is the feature. A kit of 64 skills where every skill fires on every task would be worse than no skills at all.

## If you want to run this end-to-end

```bash
# Install once (macOS / Linux — Windows users use scoop or the PowerShell installer)
brew install tahirraufkeeyu/tap/skillskit
skillskit install developers

# Clone and run
cd ~/src
git clone https://github.com/hagopj13/node-express-boilerplate.git
cd node-express-boilerplate
cp .env.example .env  # edit MONGODB_URL and JWT_SECRET
yarn install
claude
```

Then follow the prompts in Steps 1–9. You'll end up with a working bookmarks feature, tests green, PR-ready.

## What to try next

- Swap the feature for something else — "add rate limiting per user", "add email verification", "add GraphQL alongside the REST API" — and run through the same skill flow.
- Try the `ship-feature` orchestrator as the *first* move on a new feature, rather than as a follow-up check. You'll see the orchestrator halt if your code has review blockers, which is the intended failure mode.
- If you're in a security-sensitive codebase, replace Steps 5–6 with `full-security-audit` + `full-security-remediation` (the security department's orchestrator pair).

See [../README.md](../README.md) for the full list of examples, or [../../README.md](../../README.md) for the kit overview.
