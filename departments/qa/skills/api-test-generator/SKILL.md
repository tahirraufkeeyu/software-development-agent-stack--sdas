---
name: api-test-generator
description: Use when an OpenAPI 3.x specification (or URL to one) needs to be turned into a runnable API test suite. Generates Schemathesis property-based tests, REST-assured (Java) suites, or supertest (Node) specs covering positive, negative, auth, and rate-limit flows — and validates every response against the declared schema.
safety: writes-local
---

## When to use

Invoke this skill when:
- A team maintains an OpenAPI 3.0 / 3.1 document (`openapi.yaml`, `openapi.json`).
- CI needs a contract-drift guard that fails when responses diverge from the spec.
- You want property-based fuzzing (Schemathesis) without hand-writing input permutations.
- You need a fast port of the OpenAPI spec into an existing Java/Node test project.

Do NOT use when: the service has no machine-readable spec (write OpenAPI first); the flow is multi-step UI interaction (use `e2e-test-generator`); you need a load test (use `performance-test` or k6/Gatling — outside scope).

## Inputs

- `spec` (required): Path or URL to OpenAPI 3.x document.
- `target` (required): `schemathesis`, `rest-assured`, or `supertest`.
- `base_url` (required): Origin to test against, e.g. `https://staging.example.com/api`.
- `auth` (optional): `{ type: "bearer" | "apiKey" | "basic", env: "TEST_TOKEN" }`. Default bearer from `TEST_TOKEN`.
- `rate_limit_threshold` (optional): Requests/second to use in rate-limit test. Default `20`.
- `out_dir` (optional): Where to write tests. Defaults per target: `tests/contract/`, `src/test/java/contract/`, `test/api/`.

## Outputs

- For `schemathesis`: a `pytest` module `test_contract.py`, a `conftest.py` with auth fixture, and a shell command to invoke via CLI.
- For `rest-assured`: one Java class per tag in the spec plus a `BaseApiTest` with auth setup.
- For `supertest`: one `.test.ts` per resource with Jest/Vitest describe blocks.
- A coverage report mapping each (path, method, response code) in the spec to a generated test.

## Tool dependencies

- `Read`, `Write`, `Grep`, `Glob` (always).
- `WebFetch` when `spec` is a URL.
- For `schemathesis`: user must have `pip install schemathesis pytest` in their test env.
- For `rest-assured`: Maven/Gradle dependency `io.rest-assured:rest-assured:5.x`.
- For `supertest`: `npm i -D supertest @types/supertest jest ajv` (or vitest).

## Procedure

1. **Load the spec.** If URL, fetch. Parse YAML/JSON. Extract: servers, securitySchemes, paths, operationIds, tags, request/response schemas.
2. **Bucket endpoints.** Group by tag; one file per tag (rest-assured, supertest) or a single pytest module (schemathesis).
3. **Resolve auth.** Map `securitySchemes` to an auth fixture that reads the token from `auth.env`.
4. **Generate positive tests.** For each operation, produce a request with a minimal valid body (schemathesis does this automatically; for manual targets, instantiate from `example` or required-fields-only).
5. **Generate negative tests.**
   - Missing required fields → expect `400`.
   - Wrong type (`string` where `integer`) → expect `400` or `422`.
   - Unauthenticated call → expect `401`.
   - Wrong scope / forbidden → expect `403`.
   - Unknown resource id → expect `404`.
6. **Generate rate-limit test.** Fire `rate_limit_threshold * 2` requests in a burst against a GET endpoint; assert at least one `429` and that `Retry-After` is present.
7. **Validate every response against schema.** Use `schemathesis` built-in validation, `rest-assured.matchesJsonSchema`, or `ajv` in supertest.
8. **Emit a coverage table.** Markdown file listing endpoint × response code × covered/uncovered.
9. **Write CI snippet.** A `Makefile` target or GitHub Actions step to run the suite on every PR.

## Examples

### Example 1 — Schemathesis (Python) against a petstore spec

Command (stateful + property-based):

```bash
schemathesis run \
  --checks all \
  --hypothesis-deadline=5000 \
  --hypothesis-max-examples=50 \
  --header "Authorization: Bearer $TEST_TOKEN" \
  --base-url "$BASE_URL" \
  https://petstore.example.com/openapi.json
```

`tests/contract/conftest.py`

```python
import os
import pytest
import schemathesis

SCHEMA_URL = os.environ["SPEC_URL"]
schema = schemathesis.from_uri(SCHEMA_URL)

@pytest.fixture
def auth_headers():
    token = os.environ["TEST_TOKEN"]
    return {"Authorization": f"Bearer {token}"}
```

`tests/contract/test_contract.py`

```python
import schemathesis
from conftest import schema

@schema.parametrize()
def test_api_conforms_to_spec(case, auth_headers):
    response = case.call(headers=auth_headers)
    case.validate_response(response)  # schema + status + content-type

@schema.parametrize(endpoint="/pet")
def test_unauthenticated_is_401(case):
    response = case.call(headers={})
    assert response.status_code == 401

@schema.parametrize(endpoint="/pet", method="POST")
def test_missing_required_fields_is_400(case):
    case.body = {}  # strip required fields
    response = case.call(headers={"Authorization": f"Bearer {__import__('os').environ['TEST_TOKEN']}"})
    assert response.status_code in (400, 422)
```

Rate-limit probe:

```python
import asyncio, httpx, pytest

@pytest.mark.asyncio
async def test_rate_limit_returns_429():
    async with httpx.AsyncClient(base_url=os.environ["BASE_URL"]) as client:
        responses = await asyncio.gather(*[client.get("/pet/1") for _ in range(40)])
    assert any(r.status_code == 429 for r in responses)
    hit = next(r for r in responses if r.status_code == 429)
    assert "retry-after" in {k.lower() for k in hit.headers}
```

### Example 2 — supertest (Node/TypeScript) for a `/users` resource

`test/api/users.test.ts`

```ts
import request from 'supertest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import spec from '../../openapi.json';

const BASE = process.env.BASE_URL!;
const TOKEN = process.env.TEST_TOKEN!;
const ajv = addFormats(new Ajv({ strict: false }));
const userSchema = spec.components.schemas.User;
const validateUser = ajv.compile(userSchema);

describe('POST /users', () => {
  it('201 and body matches User schema', async () => {
    const res = await request(BASE)
      .post('/users')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ email: 'qa+1@example.com', name: 'QA Bot' });
    expect(res.status).toBe(201);
    expect(validateUser(res.body)).toBe(true);
  });

  it('400 when required field missing', async () => {
    const res = await request(BASE)
      .post('/users')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ name: 'no email' });
    expect([400, 422]).toContain(res.status);
  });

  it('401 without token', async () => {
    const res = await request(BASE).post('/users').send({ email: 'x@y.z', name: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/:id', () => {
  it('404 for unknown id', async () => {
    const res = await request(BASE)
      .get('/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });
});

describe('Rate limiting', () => {
  it('returns at least one 429 under burst', async () => {
    const burst = await Promise.all(
      Array.from({ length: 40 }, () =>
        request(BASE).get('/users/me').set('Authorization', `Bearer ${TOKEN}`),
      ),
    );
    const hit = burst.find(r => r.status === 429);
    expect(hit).toBeDefined();
    expect(hit!.headers['retry-after']).toBeDefined();
  });
});
```

## Constraints

- Every generated test must assert **both** status code **and** schema validity on success responses.
- Never hard-code secrets; always read from env (`TEST_TOKEN`, `BASE_URL`).
- Never mutate production data — require `BASE_URL` to point at a non-prod host; fail loudly if it looks like prod.
- For Schemathesis, always pass `--checks all` so `not_a_server_error`, `response_schema_conformance`, `status_code_conformance`, `content_type_conformance` all run.
- Rate-limit tests must be quarantined behind an env flag (`RUN_RATE_LIMIT=1`) when the target is shared.
- Do not emit tests for `deprecated: true` operations unless explicitly asked.

## Quality checks

- [ ] Coverage table accounts for every `(path, method, responseCode)` in the spec.
- [ ] Auth fixture reads token from env, not repo.
- [ ] No test writes to prod (`BASE_URL` guard present).
- [ ] Schema validation present on every 2xx path.
- [ ] At least one 401, 400/422, and 404 test generated per resource with those codes declared.
- [ ] Rate-limit test present when spec declares `429` anywhere.
- [ ] CI snippet emitted and points at the correct file path.
