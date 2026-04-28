# API standards

Reference tables and snippets for designing consistent HTTP and GraphQL APIs. Cite the section in reviews and spec output.

## HTTP status code matrix

| Code | When to use | When NOT to use |
| --- | --- | --- |
| 200 OK | Successful GET; successful PUT/PATCH/DELETE that returns a body | Async acceptance (use 202); creation (use 201) |
| 201 Created | Resource created synchronously; set `Location` header to the new resource | A write that does not create a new resource |
| 202 Accepted | Work queued; return a poll URL or a status resource | Completed work |
| 204 No Content | Successful write with no useful body | Empty-result list queries (use 200 with `{data: []}`) |
| 301 / 308 | Permanent redirect; 308 preserves method | Temporary routing; HTTPS upgrade (handle at edge) |
| 302 / 307 | Temporary redirect; 307 preserves method | Anything you want cached |
| 304 Not Modified | Conditional GET with matching `ETag` / `If-None-Match` | Error signalling |
| 400 Bad Request | Request is syntactically malformed (bad JSON, missing required field) | Business-rule violation (use 422) |
| 401 Unauthorized | Credentials missing or invalid; include `WWW-Authenticate` | Authenticated but lacking permission (use 403) |
| 403 Forbidden | Authenticated but the action is not allowed | Missing credentials (use 401) |
| 404 Not Found | Resource does not exist and existence is not privileged | Forbidden access to a known-existing resource (may still use 404 to avoid leak; document the policy) |
| 405 Method Not Allowed | Verb not supported at this path; include `Allow` header | Route not found (404) |
| 409 Conflict | Resource state conflict (unique constraint, version mismatch) | Validation error (422) |
| 410 Gone | Resource existed and is permanently removed | Temporary unavailability (503) |
| 412 Precondition Failed | `If-Match` / `If-Unmodified-Since` did not match | Generic validation failure |
| 415 Unsupported Media Type | `Content-Type` not acceptable | Content was accepted but malformed (400) |
| 422 Unprocessable Entity | Semantically invalid (fails business rule) | Malformed syntax (400) |
| 429 Too Many Requests | Rate limit exceeded; include `Retry-After` | Long-running work (use 202) |
| 500 Internal Server Error | Unhandled server fault | Client errors |
| 502 Bad Gateway | Upstream returned an invalid response | Local crash (500) |
| 503 Service Unavailable | Overloaded or maintenance; include `Retry-After` | Long-term outage (use 410 for endpoints that are permanently gone) |
| 504 Gateway Timeout | Upstream timeout | Local deadline exceeded in a poll (use 408 or a 202 status resource) |

## Idempotency keys

- Require on every non-idempotent POST that clients may retry (payments, send-notification, create-subscription).
- Accept `Idempotency-Key: <opaque-client-id>` in the request header; reject if missing when required.
- Server stores `(key, request-hash) -> response` for at least 24 hours (extend to 7 days for payments).
- On replay with matching hash: return the stored response verbatim (including status code and headers).
- On replay with mismatching hash under the same key: return `409 Conflict` with code `idempotency_key_reused`.

## Pagination

### Cursor (preferred for anything over a few hundred items)

Request: `GET /invoices?limit=20&cursor=eyJpZCI6ImludF8xMjMifQ`.

Response:

```json
{
  "data": [ /* up to limit items */ ],
  "next_cursor": "eyJpZCI6ImludF8xNDMifQ",
  "has_more": true
}
```

Properties:

- Cursor is opaque (base64 of the sort key + tiebreaker id). Never expose offsets inside.
- Stable under writes; new records appearing during traversal do not cause skips or duplicates.
- `limit` is bounded (e.g., `1 <= limit <= 100`); pick a default of 20 or 50.
- Sort order is part of the cursor; do not allow changing sort between pages.

### Offset (acceptable for admin UIs over stable data)

Request: `?offset=40&limit=20`.

Tradeoffs: breaks under concurrent writes (skip/dup), O(offset) in many SQL engines, simple to implement, allows "go to page 7" UX. Avoid for public APIs.

## Versioning

| Strategy | When | Example |
| --- | --- | --- |
| Date-based header | Default; granular, evolvable | `Api-Version: 2026-04-19` |
| URL prefix | Small public API, external developers used to it | `/v1/invoices` |
| Media type | RESTful purists; hard for clients | `Accept: application/vnd.acme.v1+json` |
| In body | Never | — |

Deprecation policy template: publish the end-of-life date in the changelog and in a `Sunset:` header on responses to deprecated versions. Maintain at least 6 months after announcement.

## Error envelope (RFC 7807 problem+json)

Every error response uses `Content-Type: application/problem+json` and this shape:

```json
{
  "type": "https://api.acme.example/problems/insufficient-funds",
  "title": "Insufficient funds",
  "status": 402,
  "detail": "The customer's default source has a balance of $0.00 against a charge of $1200.00.",
  "instance": "/invoices/inv_123:pay",
  "code": "insufficient_funds",
  "trace_id": "01HXYZ...",
  "field_errors": [
    { "field": "amount_cents", "code": "max_exceeded", "message": "cannot exceed 1,000,000" }
  ]
}
```

Rules:

- `type` is a stable URL that documents the error class; never reuse across meanings.
- `code` is a machine-readable stable identifier; `title` is human-readable.
- `trace_id` echoes the server's request id so support can look it up.
- Use `field_errors` only for `422` validation failures.

## Rate limit headers

On every response (success or failure):

```
RateLimit-Limit: 1000
RateLimit-Remaining: 872
RateLimit-Reset: 42
```

Follow draft RFC IETF `draft-ietf-httpapi-ratelimit-headers`. `Reset` is seconds until the window resets. Additionally on `429`:

```
Retry-After: 30
```

## Caching and conditional requests

- Include `ETag: "<hash>"` on cacheable GETs. Support `If-None-Match` for `304`.
- Include `Last-Modified` when a timestamp is authoritative.
- For mutations, accept `If-Match: "<etag>"` to implement optimistic concurrency; return `412` on mismatch.
- Set `Cache-Control: private, max-age=<n>` or `no-store` explicitly; never leave it to defaults.

## Content negotiation

- Accept `application/json` by default; use `application/problem+json` for errors; use `application/vnd.<org>.<type>+json` for versioned media types only if that is the chosen versioning strategy.
- Reject `Content-Type: application/x-www-form-urlencoded` on JSON APIs with a `415`.

## Request and response conventions

- IDs are opaque strings with a type prefix (`usr_`, `inv_`, `evt_`). Never leak autoincrementing ints.
- Timestamps are RFC 3339 UTC (`2026-04-19T12:34:56Z`). No epoch seconds; no local times.
- Money is `{ amount_cents: integer, currency: "usd" }`. Never floats.
- Enum values are lowercase snake strings (`in_progress`, not `InProgress`).
- Booleans: no tri-state (`true`/`false`/`null` that means "unknown"); model the unknown as a separate enum.

## URL and naming

- Resources are plural nouns: `/invoices`, not `/invoice` or `/getInvoices`.
- Sub-resources are nested when the relationship is strong: `/customers/{id}/invoices`. Otherwise query: `/invoices?customer_id=...`.
- Actions on a resource use the `:verb` suffix: `POST /invoices/{id}:pay` (Google AIP convention). Keep these rare.
- kebab-case in paths; snake_case in JSON bodies (or camelCase; pick one per API).

## Webhooks

- Sign payloads with a timestamped HMAC: `X-Acme-Signature: t=<unix>,v1=<hmac>`.
- Tolerate up to 5 minutes of clock skew; reject older.
- Expect the receiver to be idempotent using the event `id`; retry with exponential backoff for up to 48 hours.
- Document the full event catalogue; version events separately from the REST surface (`event_type@v1`).

## GraphQL specifics

- Prefer non-null; null means "unknown or not applicable", not "missing".
- Relay-style pagination: `{ edges { node, cursor }, pageInfo { hasNextPage, endCursor } }`.
- Mutations return `{ resource, userErrors: [{ field, message, code }] }`; infrastructure errors go through the `errors` array.
- Use persisted queries in production to cap query size and enable CDN caching.
- Every list field has a DataLoader batch key; write an N+1 test per resolver.
