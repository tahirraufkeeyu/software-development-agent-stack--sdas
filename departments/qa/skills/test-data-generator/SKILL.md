---
name: test-data-generator
description: Use when realistic, seeded test data is needed from a JSON Schema, OpenAPI component schema, or database schema (PostgreSQL / MySQL / SQLite DDL). Generates reproducible records that honor constraints (unique, min/max, enum, foreign keys, formats) using faker libraries, and emits SQL inserts, JSON, or CSV. Supports a seed for deterministic runs.
---

## When to use

Invoke this skill when:
- A new integration test needs seeded rows in staging.
- An e2e test needs JSON fixtures matching a schema.
- A developer wants bulk data for a local DB (1k–100k rows).
- CSV import flows need test payloads at multiple sizes.

Do NOT use when: the data must be genuine PII from production (never; mask at source instead); the schema does not exist (write it first).

## Inputs

- `schema` (required): Path to JSON Schema, OpenAPI component, or SQL DDL.
- `count` (required): Number of records per entity.
- `format` (required): `sql`, `json`, or `csv`.
- `seed` (optional): Integer seed for faker. Default `42`.
- `locale` (optional): Faker locale, e.g. `en`, `de`, `ja`. Default `en`.
- `relations` (optional): Explicit FK order, e.g. `["users", "orders", "order_items"]`.
- `overrides` (optional): Per-field generators, e.g. `{ "users.email": "{{internet.email}}" }`.

## Outputs

- Generated data file(s):
  - `sql`: one `.sql` file per table with `INSERT` statements wrapped in a transaction.
  - `json`: one `.json` file per entity (array of records).
  - `csv`: one `.csv` per entity with header row.
- A `manifest.json` recording the seed, locale, counts, and hash of the output for reproducibility.

## Tool dependencies

- `Read`, `Write`, `Glob`, `Grep` (always).
- JS: `@faker-js/faker` (v8+), `ajv` for post-generation validation.
- Python: `Faker` (`pip install faker`), `jsonschema`.
- Optional `mimesis` (Python) for faster bulk generation.

## Procedure

1. **Parse the schema.**
   - JSON Schema / OpenAPI: use `$ref` resolution; collect `required`, `enum`, `format`, `pattern`, `minLength/maxLength`, `minimum/maximum`, `uniqueItems`.
   - SQL DDL: extract `CREATE TABLE`, column types, `NOT NULL`, `UNIQUE`, `CHECK`, `REFERENCES` (FK), defaults.
2. **Topologically sort tables** by FK so parents are generated before children.
3. **Set the seed.** `faker.seed(seed)` (Python) or `faker.seed(seed)` (JS). Document in manifest.
4. **Pick generators.** Map column name + type + format to a faker call. Apply `overrides` last.
5. **Honor constraints.**
   - `unique`: generate into a `Set` and retry on collision; if after 10× `count` tries still colliding, widen the pool (e.g. append an index suffix).
   - `enum`: pick from the enum list.
   - `min/max`: clamp the faker output.
   - `pattern`: regenerate until matching; if pattern is too narrow, use a `randexp`-style generator.
   - `foreign key`: pick a random parent row id from already-generated parents.
6. **Validate.** Run each record through `ajv` (JSON/OpenAPI) or a DDL-derived check (SQL) before emitting. Fail loudly on any validation error.
7. **Emit output.**
   - SQL: `BEGIN; INSERT INTO ...; COMMIT;` per file; chunk inserts at 1,000 rows per `INSERT` for speed.
   - JSON: `JSON.stringify(data, null, 2)`; keep under 50 MB per file (split if larger).
   - CSV: RFC 4180 quoting; UTF-8 with BOM only if the target tool needs it.
8. **Write manifest.**
   ```json
   { "seed": 42, "locale": "en", "counts": { "users": 1000, "orders": 5000 }, "hash": "sha256:..." }
   ```
9. **Report.** List files, row counts, any constraints that were widened (e.g. unique pool exhaustion).

## Examples

### Example 1 — JSON output from a JSON Schema (Node)

Schema `schemas/user.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "email", "role", "createdAt"],
  "properties": {
    "id":       { "type": "string", "format": "uuid" },
    "email":    { "type": "string", "format": "email" },
    "name":     { "type": "string", "minLength": 1, "maxLength": 80 },
    "role":     { "type": "string", "enum": ["admin", "member", "guest"] },
    "age":      { "type": "integer", "minimum": 18, "maximum": 90 },
    "createdAt":{ "type": "string", "format": "date-time" }
  }
}
```

Generator `scripts/gen-users.mjs`:
```js
import { faker } from '@faker-js/faker';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import schema from '../schemas/user.json' assert { type: 'json' };

const SEED = 42, COUNT = 1000;
faker.seed(SEED);
const ajv = addFormats(new Ajv({ strict: false }));
const validate = ajv.compile(schema);

const emails = new Set();
const users = Array.from({ length: COUNT }, (_, i) => {
  let email;
  do { email = faker.internet.email().toLowerCase(); } while (emails.has(email));
  emails.add(email);
  const u = {
    id: faker.string.uuid(),
    email,
    name: faker.person.fullName().slice(0, 80),
    role: faker.helpers.arrayElement(['admin', 'member', 'guest']),
    age: faker.number.int({ min: 18, max: 90 }),
    createdAt: faker.date.past({ years: 2 }).toISOString(),
  };
  if (!validate(u)) throw new Error(`invalid user at ${i}: ${JSON.stringify(validate.errors)}`);
  return u;
});

fs.writeFileSync('fixtures/users.json', JSON.stringify(users, null, 2));
fs.writeFileSync('fixtures/manifest.json', JSON.stringify({ seed: SEED, counts: { users: COUNT } }, null, 2));
```

### Example 2 — SQL output with FK from PostgreSQL DDL (Python)

DDL `db/schema.sql`:
```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Generator `scripts/gen_seed.py`:
```python
import uuid, random, csv, json, hashlib
from faker import Faker
from pathlib import Path

SEED, USER_COUNT, ORDER_COUNT = 42, 1000, 5000
fake = Faker()
Faker.seed(SEED); random.seed(SEED)

out = Path("fixtures"); out.mkdir(exist_ok=True)
emails = set()
users = []
for _ in range(USER_COUNT):
    while True:
        e = fake.unique.email().lower()
        if e not in emails: emails.add(e); break
    users.append({"id": str(uuid.uuid4()), "email": e, "created_at": fake.date_time_this_decade().isoformat()})

orders = [{
    "id": str(uuid.uuid4()),
    "user_id": random.choice(users)["id"],
    "total_cents": random.randint(0, 50_000),
    "created_at": fake.date_time_this_year().isoformat(),
} for _ in range(ORDER_COUNT)]

def sql_values(row): return "(" + ", ".join(f"'{v}'" if not isinstance(v, int) else str(v) for v in row.values()) + ")"

with open(out / "seed.sql", "w") as f:
    f.write("BEGIN;\n")
    f.write("INSERT INTO users (id, email, created_at) VALUES\n  " +
            ",\n  ".join(sql_values(u) for u in users) + ";\n")
    f.write("INSERT INTO orders (id, user_id, total_cents, created_at) VALUES\n  " +
            ",\n  ".join(sql_values(o) for o in orders) + ";\n")
    f.write("COMMIT;\n")

manifest = {"seed": SEED, "counts": {"users": USER_COUNT, "orders": ORDER_COUNT}}
manifest["hash"] = "sha256:" + hashlib.sha256((out / "seed.sql").read_bytes()).hexdigest()
(out / "manifest.json").write_text(json.dumps(manifest, indent=2))
```

## Constraints

- Never generate PII that resembles a real person's full contact pattern; use faker so emails end in `@example.com`, `@test`, or other reserved TLDs where possible.
- Always seed; never emit data from a non-deterministic run.
- Foreign keys must reference already-generated parent ids, not random uuids.
- Unique constraints must be respected; retry with backoff, never silently drop collisions.
- Never connect to or write into a production database from this skill.
- Numeric/length ranges from the schema are authoritative; do not widen them.

## Quality checks

- [ ] Seed recorded in `manifest.json`.
- [ ] Every generated record passed schema validation (ajv/jsonschema).
- [ ] Unique fields are unique in the output (verify post-hoc via `len(set(...)) == count`).
- [ ] Foreign keys resolve to parent ids (check with a set lookup).
- [ ] Enum fields only take values from the enum list.
- [ ] SQL output is wrapped in a single transaction per file.
- [ ] CSV output passes RFC 4180 (fields with commas/quotes are quoted and escaped).
- [ ] Output files listed in the report with row counts.
