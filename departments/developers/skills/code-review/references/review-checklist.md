# Review checklist

A reviewer walks this table top-to-bottom. Each row is a concrete check that has caught real production bugs. When you flag an item, cite the row name in the finding so the author can look up the rationale.

## Security

| Check | What to look for | Example fix |
| --- | --- | --- |
| SQL injection | Any string concatenation or template literal feeding a SQL driver. Also ORM `raw()` / `queryRaw()` calls. | Parameterised queries; bound parameters in ORMs. |
| NoSQL injection | User input flowing directly into Mongo `$where`, filter objects, or Redis `EVAL` scripts. | Validate shape; reject unexpected operators; use typed query builders. |
| Command injection | `exec`, `spawn(..., {shell: true})`, `os.system`, `subprocess.run(..., shell=True)` with user input. | `spawn(cmd, [args], {shell: false})`; shlex.quote for legacy paths. |
| Path traversal | User-supplied filenames joined with `path.join` or passed to `fs.readFile`, `open`, `sendFile`. | Resolve to absolute, assert `startsWith(rootDir)`; reject `..` segments. |
| SSRF | `fetch`/`requests.get`/`http.Get` with a URL derived from user input. | Allow-list of hosts; block RFC1918, link-local, metadata IP (169.254.169.254). |
| XSS | Any `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `{{{...}}}`, `document.write`, unescaped templates. | Render as text; sanitise with DOMPurify; use framework-default escaping. |
| CSRF | State-changing endpoints without a CSRF token, SameSite cookie check, or Origin/Referer check. | SameSite=Lax/Strict cookies; double-submit token; check Origin on mutations. |
| Authn | Endpoints that do not require a session or token where siblings do. Silent `req.user ?? anonymous`. | Route-level middleware; fail closed; 401 not 200+anonymous. |
| Authz | Access control based only on the ID in the path; IDOR; `admin` flag read from the client. | Authorise at the data layer; check `resource.owner_id === req.user.id`. |
| Secret handling | Hardcoded keys, tokens, or passwords; secrets in logs; secrets in error responses. | Env vars; a secret manager; redact in logger middleware. |
| Crypto | `md5`/`sha1` for passwords or signatures; `Math.random()` for tokens; custom crypto. | Argon2id/bcrypt for passwords; `crypto.randomBytes`/`secrets.token_urlsafe`; use a vetted library. |
| Deserialisation | `pickle.loads`, `yaml.load` (not `safe_load`), `Marshal.load`, Java `ObjectInputStream`. | `yaml.safe_load`; JSON; signed envelopes for any untrusted source. |
| Rate limiting | Login, password reset, signup, expensive search endpoints without a limiter. | Token bucket per IP + per account; exponential backoff on failure. |
| Dependency CVEs | Newly-added dependency with known advisories; pinned to a vulnerable version. | `npm audit`, `pip-audit`, `govulncheck`; bump or swap. |
| TLS / transport | `http://` in production config; `rejectUnauthorized: false`; `verify=False` in `requests`. | Enforce HTTPS; keep TLS verification on; pin only with a rotation plan. |

## Correctness

| Check | What to look for | Example fix |
| --- | --- | --- |
| Null / undefined | Dereference of a value that a recent change made nullable; optional chaining masking a real bug. | Explicit null-guard + early return with a typed error. |
| Off-by-one | Loops with `<=` vs `<`; slice endpoints; pagination `offset + limit`. | Write the loop invariant in a comment; unit-test the boundary. |
| Error swallowing | `catch {}`, `except: pass`, `if err != nil { return nil }`. | Log with context; re-raise or wrap; never discard silently. |
| Promise / async | Missing `await`, forgotten `.catch`, `Promise.all` with side-effects that must be sequential. | `await`; `Promise.allSettled` when partial failure is acceptable. |
| Concurrency | Shared mutable state without a lock; TOCTOU (`if exists; then write`); read-modify-write on DB without a transaction. | Mutex / atomic op; `SELECT ... FOR UPDATE`; optimistic concurrency with version column. |
| Timezones | `new Date(str)` without a timezone; `datetime.now()` in business logic. | Store UTC; use `zoneinfo`/`Temporal`; format at the edge only. |
| Floating point | `==` on floats; money stored as `float`. | Epsilon comparison; integer cents or `Decimal`. |
| Encoding | `atob`/`btoa` on non-ASCII; `Buffer.from(s)` without encoding; naive `.length` on unicode. | Base64url; specify `'utf8'`; use grapheme-aware splitter. |
| State machine | New state added without updating all transition sites. | Exhaustive switch; never `default` silently. |
| Feature flags | Flag read once at boot; flag without a default; flag with no kill path. | Read per-request; safe default (off); tested rollback. |

## Performance

| Check | What to look for | Example fix |
| --- | --- | --- |
| N+1 queries | Loop over a collection calling the DB inside; ORM lazy relations without `.include`/`select_related`. | Batch with `WHERE id IN (...)`; dataloader; eager-load. |
| Unbounded result sets | Endpoint returns `SELECT *` with no `LIMIT`; `find_all()` without pagination. | Cursor pagination (see api-standards); hard upper bound. |
| Unbounded loops | `while` on a user-controlled condition; recursion without depth bound. | Explicit max iterations; tail-recursion or iteration. |
| Synchronous I/O in hot path | `readFileSync` in a request handler; blocking call in an async function. | Async variant; move to startup; cache. |
| Cache stampede | Popular key recomputed by many requests on expiry. | Lock-around-compute; stale-while-revalidate; jittered TTL. |
| Memory | Reading a whole file, stream, or result set into memory. | Stream; chunk; generator. |
| Large payloads | Returning or accepting unbounded JSON. | Size cap; streaming; pagination. |
| Hot allocations | Work inside a tight loop that allocates (regex compile, date parse). | Hoist out of loop; reuse buffers. |
| Logs as perf regressions | `JSON.stringify` of a large object on every request. | Log ids only; sample; gate on level. |

## Maintainability

| Check | What to look for | Example fix |
| --- | --- | --- |
| Dead code | New function with no caller; imports left over from a revert. | Delete; do not "keep for later". |
| Duplication | A block copy-pasted with small edits. | Extract function; parameterise. |
| Naming | Boolean named `status`; function named `process`/`handle`; abbreviations that need a glossary. | Rename using the repo's vocabulary; include the unit (`_ms`, `_bytes`). |
| Complexity | Function > ~50 lines, cyclomatic > 10, nesting > 3. | Extract; guard-clause; replace nested conditionals with polymorphism. |
| Magic numbers | Literal `86400`, `200`, `0.9` in logic. | Named constant with a unit and source comment. |
| Public API surface | New exported symbol that could be private. | Mark internal; narrow the API. |
| Comment rot | Comments describing "what" instead of "why"; stale comments. | Delete or rewrite with the rationale. |
| Formatting drift | Changes unrelated to the PR (whitespace-only hunks). | Revert or split into a format-only PR. |

## Testing

| Check | What to look for | Example fix |
| --- | --- | --- |
| New behaviour untested | Diff adds a branch but no test hits it. | Add a test that fails without the new code. |
| Test asserts nothing | `expect(fn()).resolves` without a `.toEqual`; `assert True`. | Assert on the observable effect. |
| Test mocks the code under test | `jest.mock('./the-file-being-tested')`. | Mock collaborators only; use real module under test. |
| Flaky sources | `setTimeout`, `Date.now()`, `Math.random`, real network. | Fake timers; inject clock; seeded RNG; local fixtures. |
| Missing negative test | Only the happy path is covered. | Test for 4xx/5xx paths, empty input, boundary values. |
| Over-specified | Tests assert on log text, call order, private fields. | Assert on behaviour, not implementation. |

## Observability

| Check | What to look for | Example fix |
| --- | --- | --- |
| Missing log on error | `catch` branch that returns an error response without logging. | `log.error({ err, requestId }, 'context')`. |
| Log leaks PII / secrets | Logging the whole request body; dumping user objects. | Allow-list fields; redact; hash. |
| No correlation id | New async boundary that drops the request/trace id. | Propagate `traceparent` / `X-Request-ID`. |
| Silent metric regression | New code path that previously emitted a metric no longer does. | Keep the metric; add a test for its presence if critical. |
| Alert-worthy without alert | New failure mode that should page but has no signal. | Counter + SLO; runbook entry. |
