# DDD Implementation Rules

## Layers

- A bounded context is split into `domain`, `application`, and
  `infrastructure` Nx projects.
- Domain code depends only on domain or shared code.
- Application code defines ports and orchestrates domain behavior.
- Infrastructure implements ports, exposes controllers, and hosts query
  handlers and external integrations.
- Contexts communicate through events and never import each other directly.

## Domain Building Blocks

- Aggregates extend `AggregateRoot`, expose static `create()` and
  `reconstitute()` factories, protect state changes behind methods, and raise
  immutable past-tense domain events through `apply()`.
- Mutating aggregate methods stamp `updatedAt` and return `this`.
- Value objects extend `ValueObject<T>`, use private constructors and static
  factories, validate on creation, and compare by value.
- Domain invariant failures extend `DomainError`.
- Domain events implement `DomainEvent`, carry IDs and scalar data only, and
  use a logical bounded-context name in `context`.
- Keep a concrete value object in shared domain only when it is intentionally
  reusable across contexts.

## Application And Infrastructure

- Use cases expose one `execute(command)` method and modify one aggregate per
  transaction.
- Application ports extend shared repository contracts and do not expose ORM
  types.
- Concrete repositories extend `BaseRepository`; only `BaseRepository` reads
  and clears aggregate domain events.
- Query handlers live in infrastructure, query Prisma directly, and return
  read-oriented shapes without loading aggregates.
- Export each project's public API through `src/index.ts`.

## Testing

Place focused `*.spec.ts` files beside source. Cover factories, invariants,
state transitions, event emission, error paths, and adapter behavior.
