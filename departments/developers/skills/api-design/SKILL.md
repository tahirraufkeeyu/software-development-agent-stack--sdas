---
name: api-design
description: Use when the user is designing a new HTTP or GraphQL endpoint, reviewing an API for consistency, or asking how to version, paginate, or error from a public interface. Produces a resource model, an endpoint table, and an OpenAPI 3.1 spec fragment (or a GraphQL SDL fragment) that follows REST best practice.
---

## When to use

- User is about to add a new endpoint and asks how to design it.
- User is cleaning up an inconsistent API (mixed pluralisation, ad-hoc errors, missing pagination).
- User wants an OpenAPI fragment generated for a described resource.
- User is deciding between REST and GraphQL, or between URL and header versioning.

Do not use this skill to implement the endpoint (that is feature work) or to write client SDKs (separate).

## Inputs

- The domain concept: resource name, fields, relationships, lifecycle.
- The operations needed: read, write, list, search, partial update, soft delete.
- Non-functional constraints: expected QPS, payload size, auth model, idempotency requirements.

## Outputs

For REST:

1. Resource model: the canonical noun, its fields with types, its sub-resources.
2. Endpoint table: method, path, purpose, auth scope, idempotency, status codes.
3. OpenAPI 3.1 fragment (YAML) including `paths`, `components.schemas`, and shared error envelope.
4. Notes on pagination, versioning, and rate limit headers.

For GraphQL:

1. SDL fragment (types, queries, mutations, subscriptions) with nullability clearly reasoned.
2. N+1 mitigation plan (DataLoader keys, batch sources).
3. Error strategy (union types vs errors array).

## Tool dependencies

- Read/Grep to scan the repo's existing API surface for consistency.
- Context7 MCP to check the current idioms of the framework in use (Fastify, FastAPI, go-chi, Axum, Apollo, urql).
- Optional: a linter/spectral ruleset for the OpenAPI output.

## Procedure

1. Clarify the resource. Write down its singular and plural form (`invoice` / `invoices`), the stable identifier type (usually an opaque string prefixed by type: `inv_...`), and the fields with types and nullability. If the identifier is a natural key (email, slug), note whether it is safe to put in the URL.
2. Map operations to the matrix in [references/api-standards.md](references/api-standards.md). Choose REST verbs or GraphQL operations explicitly; justify any deviation (e.g. an RPC-style action `POST /orders/:id:cancel` when the state transition does not fit a resource update).
3. For each endpoint, pick the correct status codes. Use the matrix in the references — do not invent. In particular:
   - `200` for a successful GET or a PUT/PATCH/DELETE that returns a body.
   - `201` only for creation with a `Location` header.
   - `202` for accepted-but-async; include a poll URL.
   - `204` for success with no body.
   - `400` for a malformed request (syntactic); `422` for a semantically invalid one.
   - `401` for missing/invalid credentials; `403` for authenticated-but-forbidden.
   - `404` for a resource that does not exist and where existence is not privileged information; otherwise prefer `403` or `404` consistently (pick a policy).
   - `409` for a version conflict; `412` for a failed `If-Match` precondition.
   - `429` for rate limited.
4. Idempotency. For any non-idempotent POST that can be retried (payments, notifications), require an `Idempotency-Key` header with a documented retention window. `PUT` and `DELETE` are idempotent by definition; make sure the implementation actually honours that.
5. Pagination. Default to cursor pagination for anything that can exceed a few hundred items. Expose `?limit=` (bounded) and `?cursor=`; return `next_cursor` in the body. Offset pagination is acceptable only for admin UIs over stable, non-mutating data.
6. Versioning. Default to date-based versioning in a request header: `Api-Version: 2026-04-19`. URL versioning (`/v1/...`) is acceptable when the surface is small and clients are external. Never version inside the body.
7. Errors. Always use RFC 7807 `application/problem+json` with fields `type`, `title`, `status`, `detail`, `instance`, plus a stable `code` and a `trace_id`. One error shape per failure, not a mix.
8. Rate limiting. Always return `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` on every response (per draft RFC). On `429`, also `Retry-After`.
9. Generate the OpenAPI 3.1 fragment. Use components to share the error schema and pagination envelope. Validate the fragment against the JSON Schema for OpenAPI.
10. Write the consistency note. Compare the new endpoints against the repo's existing ones: pluralisation, casing (snake vs camel), date format (always RFC 3339 UTC), id prefixes. Flag any deviation.

For GraphQL:

- Prefer non-null fields; allow null only where the domain actually has "unknown" or "not applicable".
- Use input types for mutations; return a payload type with `{ resource, userErrors }`.
- Plan for N+1 from day one — every type that resolves to a collection must be batched via DataLoader.

## Examples

### Happy path: REST resource for invoices

Resource: `invoice`, id `inv_...`, fields `id`, `customer_id`, `amount_cents`, `currency` (ISO 4217), `status` (`draft|open|paid|void`), `created_at`, `paid_at?`.

Operations: create (POST, idempotency-key), get, list (cursor), mark paid (action), void (action), download PDF (action returning `202` with poll URL).

Endpoint table:

| Method | Path | Purpose | Auth | Idempotent | Codes |
| --- | --- | --- | --- | --- | --- |
| POST | /invoices | create | invoices:write | via Idempotency-Key | 201, 400, 409, 422 |
| GET | /invoices/{id} | read | invoices:read | yes | 200, 404 |
| GET | /invoices | list | invoices:read | yes | 200, 400 |
| POST | /invoices/{id}:pay | mark paid | invoices:write | yes | 200, 404, 409 |
| POST | /invoices/{id}:void | void | invoices:write | yes | 200, 404, 409 |
| POST | /invoices/{id}:pdf | render pdf | invoices:read | yes | 202 |

OpenAPI 3.1 fragment:

```yaml
openapi: 3.1.0
info: { title: Invoices API, version: "2026-04-19" }
paths:
  /invoices:
    post:
      operationId: createInvoice
      parameters:
        - { in: header, name: Idempotency-Key, required: true, schema: { type: string, minLength: 1, maxLength: 255 } }
        - { in: header, name: Api-Version, required: true, schema: { type: string, format: date } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InvoiceCreate' }
      responses:
        '201':
          description: Created
          headers:
            Location: { schema: { type: string, format: uri } }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Invoice' }
        '400': { $ref: '#/components/responses/Problem' }
        '409': { $ref: '#/components/responses/Problem' }
        '422': { $ref: '#/components/responses/Problem' }
    get:
      operationId: listInvoices
      parameters:
        - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
        - { in: query, name: cursor, schema: { type: string } }
        - { in: query, name: status, schema: { type: string, enum: [draft, open, paid, void] } }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                required: [data]
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Invoice' } }
                  next_cursor: { type: string, nullable: true }
components:
  schemas:
    Invoice:
      type: object
      required: [id, customer_id, amount_cents, currency, status, created_at]
      properties:
        id: { type: string, pattern: '^inv_[A-Za-z0-9]+$' }
        customer_id: { type: string, pattern: '^cus_[A-Za-z0-9]+$' }
        amount_cents: { type: integer, minimum: 0 }
        currency: { type: string, minLength: 3, maxLength: 3 }
        status: { type: string, enum: [draft, open, paid, void] }
        created_at: { type: string, format: date-time }
        paid_at: { type: string, format: date-time, nullable: true }
    InvoiceCreate:
      type: object
      required: [customer_id, amount_cents, currency]
      properties:
        customer_id: { type: string }
        amount_cents: { type: integer, minimum: 1 }
        currency: { type: string, minLength: 3, maxLength: 3 }
    Problem:
      type: object
      required: [type, title, status, code]
      properties:
        type: { type: string, format: uri }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        instance: { type: string }
        code: { type: string }
        trace_id: { type: string }
  responses:
    Problem:
      description: Error
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
```

### Edge case: GraphQL mutation with domain errors

Design:

```graphql
type Invoice {
  id: ID!
  amountCents: Int!
  currency: String!
  status: InvoiceStatus!
  createdAt: DateTime!
  paidAt: DateTime
}

enum InvoiceStatus { DRAFT OPEN PAID VOID }

input PayInvoiceInput { invoiceId: ID!, idempotencyKey: String! }

type UserError { field: String, message: String!, code: String! }

type PayInvoicePayload {
  invoice: Invoice
  userErrors: [UserError!]!
}

type Mutation {
  payInvoice(input: PayInvoiceInput!): PayInvoicePayload!
}
```

Notes:

- `invoice` is nullable on the payload so that when `userErrors` is non-empty the client does not need to interpret a partial `Invoice`.
- `userErrors` holds domain errors (e.g. `{ code: "ALREADY_PAID" }`); infrastructure errors still go through the GraphQL `errors` array.
- N+1: `Invoice.customer` uses a per-request DataLoader keyed on `customer_id`.

## Constraints

- Never return `200` with `{ "error": ... }` as a success. A failure is a 4xx/5xx with `problem+json`.
- Never use verbs as path segments in REST (`/getUsers`); state transitions use `POST /:id:action`.
- Never mix snake_case and camelCase field names across one API. Pick one.
- Never put secrets, tokens, or PII in path or query parameters — always in headers or body.
- Never paginate with offset for mutable data; cursors only.
- Never break wire compatibility without a version bump and a deprecation window.
- Do not invent status codes; use the matrix.

## Quality checks

- Every endpoint has an `operationId`, a documented request and response schema, and explicit error responses.
- Fragment validates against `https://spec.openapis.org/oas/3.1/schema/2022-10-07`.
- Id types use a stable prefix and a regex pattern.
- All timestamps are `format: date-time` (RFC 3339 UTC).
- There is exactly one error envelope shape across the API.
- Rate-limit and idempotency-key headers are documented where they apply.
- Casing, pluralisation, and date format match any pre-existing endpoints in the repo.
