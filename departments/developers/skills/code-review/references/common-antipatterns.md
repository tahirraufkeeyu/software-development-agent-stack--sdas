# Common antipatterns

Reference catalogue for labelling findings precisely. Each entry has a short definition, a smell to look for, a before/after, and the refactoring that fixes it. Cross-links to `refactor/references/refactoring-patterns.md`.

## 1. God object

A class that knows too much and does too much. Smell: dozens of methods, many unrelated fields, imports from every layer.

Before (TypeScript):

```ts
class UserManager {
  createUser(...) {}
  sendWelcomeEmail(...) {}
  chargeSubscription(...) {}
  generateInvoicePdf(...) {}
  exportCsv(...) {}
}
```

After: split by responsibility.

```ts
class UserService { createUser(...) {} }
class EmailService { sendWelcome(...) {} }
class BillingService { charge(...) {} }
class InvoiceRenderer { toPdf(...) {} }
```

Fix: extract class; move method.

## 2. Feature envy

A method that uses another object's data more than its own.

Before:

```ts
function totalPrice(cart: Cart) {
  return cart.items.reduce((s, i) => s + i.quantity * i.product.price, 0);
}
```

After: move the behaviour next to the data.

```ts
class LineItem {
  subtotal() { return this.quantity * this.product.price; }
}
class Cart {
  total() { return this.items.reduce((s, i) => s + i.subtotal(), 0); }
}
```

Fix: move method.

## 3. Primitive obsession

Modelling domain concepts with raw primitives, so invariants leak everywhere.

Before:

```python
def send_email(to: str, body: str): ...
send_email("not-an-email", "hi")  # no compile-time check
```

After:

```python
from dataclasses import dataclass
@dataclass(frozen=True)
class Email:
    value: str
    def __post_init__(self):
        if "@" not in self.value: raise ValueError("invalid email")

def send_email(to: Email, body: str): ...
```

Fix: introduce value object; replace data value with object.

## 4. Long parameter list

Five or more positional parameters, often with Booleans.

Before:

```ts
createUser(email, name, age, country, isAdmin, isVerified, wantsNewsletter);
```

After:

```ts
createUser({ email, name, age, country, roles: ['admin'], flags: { verified: true, newsletter: true } });
```

Fix: introduce parameter object; replace boolean parameters with explicit types.

## 5. Shotgun surgery

A single conceptual change requires edits in many files.

Smell: "to rename a field I touched 14 files".

Fix: consolidate the concept behind a module boundary; inline or extract until one change = one file.

## 6. Callback hell / pyramid of doom

Before:

```js
getUser(id, (err, u) => {
  if (err) return cb(err);
  getOrders(u.id, (err, o) => {
    if (err) return cb(err);
    getInvoice(o[0].id, (err, i) => {
      if (err) return cb(err);
      cb(null, i);
    });
  });
});
```

After:

```js
async function flow(id) {
  const u = await getUser(id);
  const o = await getOrders(u.id);
  return getInvoice(o[0].id);
}
```

Fix: promisify + async/await.

## 7. N+1 query

A query in a loop.

Before (Python / SQLAlchemy):

```python
for user in users:
    posts = session.query(Post).filter_by(user_id=user.id).all()
```

After:

```python
users = session.query(User).options(selectinload(User.posts)).all()
```

Fix: eager loading; `WHERE id IN (...)`; DataLoader.

## 8. Leaky abstraction

A module exposes the details of its implementation in its interface.

Before:

```ts
interface UserRepo {
  rawPgClient(): Pool;                 // leak
  findByEmail(e: string): Promise<Row>;// leak: Row is a pg type
}
```

After:

```ts
interface UserRepo {
  findByEmail(e: string): Promise<User | null>;
}
```

Fix: hide transport types behind domain types; do not export driver objects.

## 9. Anaemic domain model

Entities that are only bags of fields; all behaviour lives in services.

Smell: `setState(user, 'active')` instead of `user.activate()`.

Fix: move invariants and state transitions onto the entity; keep services for orchestration only.

## 10. Magic numbers and strings

Literals sprinkled through business logic.

Before:

```go
if user.Role == 3 { ... }   // what is 3?
```

After:

```go
const RoleAdmin Role = 3
if user.Role == RoleAdmin { ... }
```

Fix: replace magic number with named constant; replace magic string with enum.

## 11. Silent error swallowing

Before:

```python
try:
    charge(user)
except Exception:
    pass
```

After:

```python
try:
    charge(user)
except StripeError as e:
    logger.exception("charge_failed", user_id=user.id)
    raise BillingError("charge failed") from e
```

Fix: catch the narrowest exception; log with context; re-raise or translate.

## 12. Boolean parameter

A flag changes behaviour, making the call site unreadable.

Before:

```ts
save(user, true, false); // what?
```

After:

```ts
save(user, { overwrite: true, audit: false });
// or split:
saveOverwriting(user);
saveCreating(user);
```

Fix: replace parameter with explicit method; use an options object with named fields.

## 13. Stringly-typed API

Any state or category passed as a bare string.

Before:

```ts
function transition(order: Order, event: string) {}
transition(order, "shippd"); // typo: silent
```

After:

```ts
type OrderEvent = 'placed' | 'paid' | 'shipped' | 'cancelled';
function transition(order: Order, event: OrderEvent) {}
```

Fix: union types or enums.

## 14. Big ball of mud configuration

A monolithic `config.json` with hundreds of knobs, half unused.

Fix: split by subsystem; validate with a schema (Zod, Pydantic, `go-playground/validator`); fail fast at boot on missing or malformed values.

## 15. Singleton global state

A module-level mutable object that tests poke at.

Fix: dependency injection; a factory function that takes its collaborators; for tests, inject fakes.

## 16. Train wreck (violation of Law of Demeter)

```ts
user.account.subscription.plan.features.pro;
```

Fix: tell-don't-ask — add a method on `User` (`hasProFeature()`) that hides the chain.

## 17. Copy-paste inheritance

Subclassing only to reuse one method.

Fix: composition; extract a helper; mix in a trait.

## 18. Premature abstraction

Interfaces with a single implementation, "because we might swap later".

Fix: inline the interface; reintroduce it only when the second implementation exists.

## 19. Stale mocks / fakes drift

Test doubles that no longer match the real collaborator's contract.

Fix: contract tests; generate the fake from the real type; or use a recording/replay library against a staging backend.

## 20. Time bomb (implicit dependency on "now")

Code whose correctness depends on the current time, OS locale, or timezone.

Fix: inject a `Clock` interface; use fixed timezones; store in UTC.
