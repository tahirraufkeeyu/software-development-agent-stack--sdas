# Refactoring patterns

A working catalogue adapted from Fowler's "Refactoring" (2nd ed.). Each entry: intent, mechanics, before/after. Use this list to name the step you are performing.

## Extract Method

Intent: turn a fragment with a clear purpose into its own function.

Mechanics: name the new function after its intent, not its implementation; copy the fragment; replace originals with a call; run tests.

Before:

```ts
function printOwing(invoice: Invoice) {
  console.log('*** Customer Owes ***');
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${invoice.amount}`);
}
```

After:

```ts
function printOwing(invoice: Invoice) {
  printBanner();
  printDetails(invoice);
}
function printBanner() { console.log('*** Customer Owes ***'); }
function printDetails(invoice: Invoice) {
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${invoice.amount}`);
}
```

## Inline Method

Intent: remove an unhelpful indirection.

Before:

```ts
function getRating(driver: Driver) { return moreThanFiveLateDeliveries(driver) ? 2 : 1; }
function moreThanFiveLateDeliveries(driver: Driver) { return driver.lateDeliveries > 5; }
```

After:

```ts
function getRating(driver: Driver) { return driver.lateDeliveries > 5 ? 2 : 1; }
```

## Extract Variable

Intent: name an intermediate value to make an expression readable.

Before:

```ts
return order.quantity * order.itemPrice
  - Math.max(0, order.quantity - 500) * order.itemPrice * 0.05
  + Math.min(order.quantity * order.itemPrice * 0.1, 100);
```

After:

```ts
const basePrice = order.quantity * order.itemPrice;
const quantityDiscount = Math.max(0, order.quantity - 500) * order.itemPrice * 0.05;
const shipping = Math.min(basePrice * 0.1, 100);
return basePrice - quantityDiscount + shipping;
```

## Inline Variable

Intent: inline a temp whose name adds no information.

Before:

```ts
const basePrice = anOrder.basePrice;
return basePrice > 1000;
```

After:

```ts
return anOrder.basePrice > 1000;
```

## Rename (Variable / Function / Field)

Intent: match the domain vocabulary. Use language-server rename; it is exhaustive.

Before: `function crt(u)` -> After: `function createUser(user)`.

## Change Function Declaration

Intent: add/remove a parameter or change the name visible across call sites.

Mechanics: add the new declaration alongside the old; migrate callers one at a time; delete the old.

## Introduce Parameter Object

Intent: replace a recurring clump of parameters with an object.

Before:

```ts
function amountInvoicedIn(startDate: Date, endDate: Date) {}
function amountReceivedIn(startDate: Date, endDate: Date) {}
function amountOverdueIn(startDate: Date, endDate: Date) {}
```

After:

```ts
class DateRange { constructor(public start: Date, public end: Date) {} }
function amountInvoicedIn(range: DateRange) {}
function amountReceivedIn(range: DateRange) {}
function amountOverdueIn(range: DateRange) {}
```

## Combine Functions Into Class

Intent: a set of functions that operate on the same data should be a class.

Before:

```python
def base_charge(reading): ...
def taxable_charge(reading): ...
def calculate_base_charge(reading): ...
```

After:

```python
class Reading:
    def base_charge(self): ...
    def taxable_charge(self): ...
```

## Move Function / Move Field

Intent: put behaviour next to the data it uses (feature envy cure).

Before: `Account.overdraftCharge()` reading only fields from `AccountType` -> After: `AccountType.overdraftCharge(balance)`.

## Encapsulate Variable / Field

Intent: wrap a global or public field with getter/setter so future rules have a place to live.

Before:

```ts
export let defaultOwner = { name: 'Martin', id: '1' };
```

After:

```ts
let _defaultOwner = { name: 'Martin', id: '1' };
export const defaultOwner = () => _defaultOwner;
export const setDefaultOwner = (owner: Owner) => { _defaultOwner = owner; };
```

## Replace Primitive With Object

Intent: turn a recurring primitive with rules into a value object (see antipattern: primitive obsession).

Before:

```ts
function priority(order: Order) { return order.priority; } // string: 'low'|'normal'|'high'
```

After:

```ts
class Priority {
  private constructor(private readonly value: 'low'|'normal'|'high') {}
  static of(v: string) { if (!['low','normal','high'].includes(v)) throw Error(); return new Priority(v as any); }
  higherThan(other: Priority) { return this.ordinal() > other.ordinal(); }
  private ordinal() { return ['low','normal','high'].indexOf(this.value); }
}
```

## Replace Conditional With Polymorphism

Intent: replace a type-switch that keeps growing with subtype dispatch. See the SKILL example.

## Replace Nested Conditional With Guard Clauses

Before:

```ts
function pay(employee: Employee) {
  let result;
  if (employee.isSeparated) { result = { amount: 0, reason: 'separated' }; }
  else {
    if (employee.isRetired) { result = { amount: 0, reason: 'retired' }; }
    else { result = payroll.lookup(employee); }
  }
  return result;
}
```

After:

```ts
function pay(employee: Employee) {
  if (employee.isSeparated) return { amount: 0, reason: 'separated' };
  if (employee.isRetired) return { amount: 0, reason: 'retired' };
  return payroll.lookup(employee);
}
```

## Decompose Conditional

Intent: replace a long boolean with named predicates.

Before:

```ts
if (date.before(SUMMER_START) || date.after(SUMMER_END)) { charge = qty * plan.winterRate + plan.winterFee; }
else { charge = qty * plan.summerRate; }
```

After:

```ts
const isSummer = (d: Date) => !d.before(SUMMER_START) && !d.after(SUMMER_END);
charge = isSummer(date) ? summerCharge(qty, plan) : winterCharge(qty, plan);
```

## Split Phase

Intent: separate code that does two jobs into two sequential phases (parse -> interpret; read -> render).

## Extract Class / Inline Class

Intent: balance responsibilities across classes; cure of god object.

## Hide Delegate / Remove Middle Man

Intent: control how much of an internal graph leaks (tell-don't-ask; cure of train-wreck antipattern).

## Replace Loop With Pipeline

Intent: express a data transformation as map/filter/reduce.

Before:

```ts
const names = [];
for (const input of people) if (input.job === 'programmer') names.push(input.name);
```

After:

```ts
const names = people.filter(p => p.job === 'programmer').map(p => p.name);
```

## Replace Error Code With Exception / Replace Exception With Return Code

Intent: pick the style that matches the rest of the codebase. Mixed styles cause bugs — standardise.

## Preserve Whole Object

Intent: pass the object instead of picking fields, reducing coupling when new fields are added.

Before:

```ts
withinRange(room.daysTempRange().low, room.daysTempRange().high);
```

After:

```ts
withinRange(room.daysTempRange());
```

## Substitute Algorithm

Intent: replace a complex algorithm with a clearer one; requires strong tests around inputs and outputs first.

## Split Variable

Intent: a variable reused for two purposes; give each use its own name.

Before:

```ts
let temp = 2 * (height + width);
console.log(temp);
temp = height * width;
console.log(temp);
```

After:

```ts
const perimeter = 2 * (height + width);
console.log(perimeter);
const area = height * width;
console.log(area);
```
