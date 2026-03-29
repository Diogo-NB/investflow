# Coding Principles

These apply to all code written or modified in this project.

## 1. Early Return Over Nested Conditionals

Prefer guard clauses that return (or throw) early. Avoid cascading `if/else` trees.

```typescript
// Bad
function process(order: Order) {
  if (order) {
    if (order.status === 'PENDING') {
      if (order.amount > 0) {
        // actual logic
      }
    }
  }
}

// Good
function process(order: Order) {
  if (!order) return;
  if (order.status !== 'PENDING') return;
  if (order.amount <= 0) return;
  // actual logic
}
```

## 2. Self-Documenting Code — Comments Only When Necessary

Code should document itself through good naming. **Do not add comments** that merely restate what the code does.

Add a comment **only** when it communicates something the code cannot express on its own:
- A warning about a non-obvious side effect
- A workaround for a bug (link to issue if possible)
- A business rule that looks wrong but is intentionally contradictory

```typescript
// Bad — restates the code
// Check if the order is expired
if (order.expiresAt < new Date()) { ... }

// Good — explains the non-obvious business rule
// Expired orders still reserve volume until explicitly released by the scheduler
if (order.expiresAt < new Date()) { ... }
```

## 3. No `any` — Use `unknown` and Be Strict

Never use `any`. Use `unknown` for values whose type is genuinely not known at compile time, then narrow explicitly.

```typescript
// Bad
function parsePayload(raw: any) {
  return raw.orderId;
}

// Good
function parsePayload(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || !('orderId' in raw)) {
    throw new Error('Invalid payload');
  }
  return (raw as { orderId: string }).orderId;
}
```

**Exceptions** — `any` is allowed only when:
- A third-party library's typings force it (no alternative types available)
- Decorators or framework internals require it (e.g. NestJS metadata reflection)

Exceptions must be accompanied by an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and a brief reason.
