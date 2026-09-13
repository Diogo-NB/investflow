# DDD Implementation Rules

## Layers

- A `libs/<context>/` grouping represents one bounded context and is split into
  `domain`, `application`, and `infrastructure` Nx projects.
- Domain code is framework-free and depends only on domain or shared-domain
  code.
- Application code defines ports and orchestrates domain behavior.
- Infrastructure implements ports, exposes controllers, and hosts query
  handlers and external integrations.
- Application and infrastructure code may use NestJS but must not depend on a
  specific deployment host.
- Contexts communicate through integration events or explicit contracts and
  never import one another's internals directly.

## Domain Building Blocks

- Aggregates extend `AggregateRoot`, expose static `create()` and
  `reconstitute()` factories, protect state changes behind methods, and raise
  immutable past-tense domain events through `apply()`.
- Mutating aggregate methods stamp `updatedAt` and return `this`.
- Value objects extend `ValueObject<T>`, use private constructors and static
  factories, validate on creation, and compare by value.
- Domain invariant failures extend `DomainError`.
- Domain events implement `DomainEvent`, carry IDs, `version`, scalar data
  only, and use a logical bounded-context name in `context`.
- Keep a concrete value object in shared domain only when it is intentionally
  reusable across contexts.

## Temporal Values

- Use the common temporal types exported by `@investflow/shared-domain` in all
  domain and application APIs:
  - `CalendarDate` for civil dates such as maturity dates and business days.
  - `CalendarDateRange` for intervals between civil dates.
  - `UtcInstant` for exact moments and audit timestamps.
- Do not expose native `Date` in domain entities, value objects, domain
  services, application commands, use cases, ports, or events. Do not implement
  business rules with `Date`, timestamps, or ad hoc date strings.
- Use the behavior already provided by the temporal value objects for creation,
  comparison, arithmetic, ranges, conversion, serialization, and deterministic
  formatting. Extend the shared value object when genuinely reusable temporal
  behavior is missing instead of duplicating raw date logic in a feature.
- Native `Date` is an interoperability type only. It may exist inside the
  temporal value-object implementation or briefly in an infrastructure adapter
  that talks to an ORM, driver, framework, or `Intl`. Convert at that boundary
  with `UtcInstant.fromDate(...)` or the defensive `UtcInstant.date` getter.
- Parse temporal transport strings once at the entry boundary. After parsing,
  pass `CalendarDate`, `CalendarDateRange`, or `UtcInstant` through application
  and domain code. Serialize them again only at output boundaries.
- Use `Clock.now()` for the current exact moment and `Clock.today()` for the
  current UTC calendar date. Only the system-clock infrastructure adapter may
  call `Date.now()` or construct a native `Date` to read the current time.
- Aggregate audit timestamps use `UtcInstant`. Mutating behavior receives an
  explicit instant and must not read the system clock from domain code.
- Domain-event timestamp fields are canonical UTC ISO strings so event payloads
  remain scalar. Event constructors receive a `UtcInstant` and serialize it.

## Application And Infrastructure

- Use cases expose one `execute(command)` method and modify one aggregate per
  transaction.
- Application ports are abstract classes, may extend shared repository
  contracts, and do not expose ORM types.
- Keep command-side repository ports narrow: aggregate lookup and persistence
  only. Do not add list, count, existence, or read-model helper methods to
  repositories. For simple uniqueness rules, prefer database constraints and
  map persistence errors to application errors.
- Concrete command-side repositories extend `BaseRepository`; only
  `BaseRepository` reads and clears aggregate domain events.
- Query handlers live in infrastructure, query Prisma directly, and return
  read-oriented shapes without loading aggregates.
- Export each project's public API through `src/index.ts`.

## Testing

Place focused `*.spec.ts` files beside source. Cover factories, invariants,
state transitions, event emission, error paths, and adapter behavior.
