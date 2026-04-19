# OWASP Top 10 (2021) — Concrete Check Set

This reference is the checklist the `security-audit` skill applies when
reviewing scanner output. Each category lists the Semgrep/ZAP/Nuclei rules
that must have fired (or been deliberately skipped) for the audit to be
considered complete, plus manual checks Claude should perform by reading
source.

## A01:2021 — Broken Access Control

Scanner rules:
- `semgrep p/owasp-top-ten` rule family `javascript.express.security.audit.express-open-redirect`
- `nuclei` tags: `idor`, `bola`, `access-control`

Manual checks:
- Every route that reads/writes user-owned data must reference the caller's
  identity (`req.user.id`) in the query, not just an ID from the path.
  `SELECT * FROM orders WHERE id = $1` is vulnerable;
  `SELECT * FROM orders WHERE id = $1 AND user_id = $2` is not.
- Verify authorization decorators exist on every admin handler
  (`@requires_role('admin')`, `authorize.admin`).
- Confirm JWT claims are verified server-side; reject `alg: none`.

Failing example:
```python
@app.get("/invoice/<int:id>")
def invoice(id):
    return db.invoices.find_one({"id": id})   # IDOR
```

Passing example:
```python
@app.get("/invoice/<int:id>")
@login_required
def invoice(id):
    return db.invoices.find_one({"id": id, "user_id": g.user.id})
```

## A02:2021 — Cryptographic Failures

Scanner rules:
- `semgrep p/owasp-top-ten` family `python.cryptography.security.insecure-hash-algorithms`
- `nuclei` tags: `tls`, `weak-cipher`, `ssl`

Manual checks:
- No MD5/SHA1 for security purposes. Password hashing is argon2id, scrypt,
  or bcrypt cost >= 12.
- TLS 1.2+ only. Reject static Diffie-Hellman, reject RC4, 3DES, export ciphers.
- Secrets not in env logs, not in error responses, not in `git log`.
- Data at rest: confirm `encrypted_at_rest: true` on every S3 bucket,
  RDS instance, EBS volume used.

Failing example:
```go
h := md5.Sum([]byte(password))     // never
```

Passing example:
```go
h, err := argon2id.CreateHash(password, argon2id.DefaultParams)
```

## A03:2021 — Injection

Scanner rules:
- `semgrep p/owasp-top-ten` family `*.sqli.*`, `*.xss.*`, `*.command-injection.*`
- `nuclei` tags: `sqli`, `xss`, `ssti`, `rce`

Manual checks:
- **SQL:** every query uses parameterized binds (`$1`, `?`, named params) or
  a vetted ORM method. No `f"SELECT ... {var}"`, no `"... " + var`, no
  `%s-substitution` into raw SQL.
- **NoSQL:** `find({username: req.body.u})` is vulnerable when `u` is an
  object — coerce to string.
- **OS command:** prefer `execFile`/`subprocess.run([...], shell=False)`.
  Any `shell=True` or `os.system` call must be justified with a comment.
- **LDAP:** escape `(`, `)`, `*`, `\`, NUL, `/`.
- **Template:** Jinja2/Handlebars with `autoescape=True`; no
  `mark_safe`/`SafeString` on user input.

Failing / passing:
```js
// bad
db.query(`SELECT * FROM u WHERE n='${name}'`);
// good
db.query('SELECT * FROM u WHERE n=$1', [name]);
// good (ORM)
User.findOne({ where: { name } });
```

## A04:2021 — Insecure Design

Scanner rules: limited automation. Relies on threat-modelling docs.

Manual checks:
- Rate limits on authentication endpoints, password reset, and any
  enumeration vector (e.g. `/api/users?email=`).
- Idempotency keys on paid actions.
- Explicit trust boundaries diagrammed; each boundary has an authZ check.
- Abuse cases documented and tested (e.g. "attacker enumerates coupon codes").

## A05:2021 — Security Misconfiguration

Scanner rules:
- `nuclei` tags: `misconfig`, `exposure`, `default-login`
- `zap` passive rules: `10021` X-Content-Type-Options, `10020` X-Frame-Options

Manual checks:
- Production mode flags (`DEBUG=False`, `NODE_ENV=production`).
- Default credentials removed from DB seeds and docker images.
- Admin UIs not exposed on the public LB.
- CORS: no `Access-Control-Allow-Origin: *` with credentials.
- CSP present and not `unsafe-inline`/`unsafe-eval` without a nonce strategy.
- HSTS on all TLS responses, `max-age >= 31536000`.

## A06:2021 — Vulnerable and Outdated Components

Driven entirely by `run-sca.sh`. Required tools per ecosystem listed in that
script's help. Additional manual review:

- Confirm transitive dependency fixes actually resolve (lockfile pinning,
  `overrides` / `resolutions` for npm, `constraints.txt` for pip).
- For forked/vendored dependencies, verify upstream CVE applicability by
  file content, not just version string.

## A07:2021 — Identification and Authentication Failures

Scanner rules:
- `zap` active rule `10202` (absence of anti-CSRF tokens)
- `nuclei` tags: `auth-bypass`, `default-login`

Manual checks:
- Password policy: length >= 12, breach-list check (HIBP k-anonymity API).
- MFA supported; TOTP secret never leaves server; backup codes rotated on use.
- Session cookies: `Secure; HttpOnly; SameSite=Lax` (or Strict for admin).
- Account lockout + progressive delay on failed login.
- OAuth: state param verified; PKCE for public clients.

## A08:2021 — Software and Data Integrity Failures

Scanner rules:
- `semgrep` family `*.insecure-deserialization.*`
- `nuclei` tag `deserialization`

Manual checks:
- No `pickle.loads`, `yaml.load` (use `yaml.safe_load`), no `Marshal.load`
  on untrusted input.
- CI/CD: signed artefacts (`cosign`, Sigstore) or SLSA level >= 2.
- Auto-update paths verify signatures, not just HTTPS.
- `npm install` uses `--ignore-scripts` in CI unless scripts explicitly required.

## A09:2021 — Security Logging and Monitoring Failures

Manual checks:
- Authentication events, authorization failures, server-side validation
  failures, and high-value transactions are logged with user, timestamp,
  source IP.
- Logs do not contain passwords, tokens, PANs, or full PII.
- Log retention meets policy (typ. 1 year hot, 7 years cold).
- Alerts fire on: brute-force threshold, new admin user, privilege change,
  disabled audit logging.

## A10:2021 — Server-Side Request Forgery (SSRF)

Scanner rules:
- `semgrep` family `*.ssrf.*`
- `nuclei` tags: `ssrf`, `cloud-metadata`

Manual checks:
- URL fetcher inputs go through an allowlist (scheme in {http, https}, host
  resolved once then re-used, resolved IP not in RFC1918 / link-local /
  metadata ranges `169.254.169.254`, `fd00::/8`, `::1`).
- Redirect chains re-validated at each hop.
- Outbound egress rules at the network layer deny metadata endpoints.

Failing example:
```python
url = request.args["url"]
requests.get(url)            # SSRF
```

Passing example:
```python
url = validate_external_url(request.args["url"])   # allowlist + IP check
requests.get(url, timeout=5, allow_redirects=False)
```

## Completion criteria

An audit is "OWASP-Top-10 complete" only when for each category one of:

- A scanner rule from the list above fired (or finished cleanly with zero
  findings), AND
- The manual checks for that category were reviewed against at least one
  code path in the repo.

The combined markdown report must include a table of A01-A10 with
"scanner-covered" / "manual-reviewed" booleans per row.
