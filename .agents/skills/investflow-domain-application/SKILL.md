---
name: investflow-domain-application
description: Implement, review, or refactor InvestFlow domain and application code. Use for aggregates, entities, value objects, domain services, use cases, application services, ports, expected errors, Results, temporal behavior, or domain-focused tests. Do not use for infrastructure-only NestJS or Prisma work, frontend work, or transactional messaging mechanics.
---

# InvestFlow Domain and Application

Model business behavior explicitly while keeping the domain independent of
frameworks and deployment concerns.

## Start with the affected context

Inspect the affected `libs/<context>/domain` and
`libs/<context>/application` projects, their public `src/index.ts` files, the
shared domain and application primitives they use, and nearby tests. Read
`docs/architecture/project-structure.md` when the change affects layer
placement, public contracts, or project boundaries.

## Layer boundaries

- Domain code depends only on its own domain project and shared-domain code. It
  must not import NestJS, Prisma, AWS SDKs, transport types, configuration, or
  process APIs.
- Application code defines ports and orchestrates domain behavior. It may use
  NestJS when needed but must not depend on a deployment host or infrastructure
  implementation.
- Contexts communicate through integration events or explicit versioned
  contracts. Do not import another context's internals or expose aggregates as
  cross-context contracts.
- Export intentional public APIs through each project's `src/index.ts`.

## Feature-first organization

- Use the same plural business-feature root across all bounded-context layers,
  such as `offers` or `issuers`. Do not organize domain by technical type while
  application is organized by feature.
- Keep a cohesive domain feature shallow under `domain/src/lib/<feature>`:
  co-locate its aggregate, entities, value objects, domain errors, and focused
  tests. Introduce role subfolders only when the feature has genuinely outgrown
  a readable flat directory.
- Under `application/src/lib/<feature>`, use one vertical slice per operation.
  Keep feature-wide repository ports and stable errors at the feature root, and
  reserve `<feature>/shared` for contracts or helpers used by multiple
  operations.
- Leave only genuinely context-wide behavior at `src/lib`; do not use global
  `aggregates`, `value-objects`, `commands`, `ports`, or `errors` folders to
  scatter one feature across the project.
- Apply the same rule to shared domain and application projects, treating a
  reusable capability as the feature root. Co-locate temporal values and
  calendars under `dates`, rate parsing and values under `rates`, and shared
  application contracts under capabilities such as `clocks` and `handlers`.
  Co-locate the mutually dependent DDD base abstractions under `foundations`.
  Do not organize shared code primarily by generic roles such as
  `value-objects`, `services`, `errors`, or `utils`.

## Domain objects

- Aggregates extend `AggregateRoot`, keep state in private props, expose
  getters, protect changes behind behavior methods, and provide static
  `create()` and `reconstitute()` factories. Raise immutable events through
  `apply()` from aggregate behavior.
- Do not add `createdAt` or `updatedAt` to domain objects only for technical
  auditing. Include temporal state only when a business invariant, transition,
  calculation, or domain event uses it. Mutating methods receive the current
  instant only when the behavior needs it.
- Value objects extend `ValueObject<T>`, use private constructors and static
  factories, validate on creation, and compare by value.
- Use `create()` returning `Result` when validation failure is expected from
  external input. Keep throwing `of()` helpers internal and throw a typed
  `DomainError` only for an invariant breach.
- Put a concrete value object in shared domain only when its semantics are
  genuinely reusable across contexts.
- Domain services contain domain calculations that do not naturally belong to
  one aggregate or value object.

## Time

- Express civil dates with `CalendarDate`, civil intervals with
  `CalendarDateRange`, and exact moments with `UtcInstant`.
- Do not expose native `Date`, timestamps, or ad hoc date strings in domain or
  application APIs, commands, ports, services, or events.
- Parse transport values once at the entry boundary and serialize them only at
  output boundaries. Extend a shared temporal value object when reusable
  behavior is missing instead of duplicating raw date logic.
- When behavior needs the current time, use `Clock.now()` for the current
  instant and `Clock.today()` for the current UTC date. Pass required time into
  domain behavior explicitly; domain code never reads the system clock.

## Application orchestration

- Use cases expose one `execute(command)` method and modify one aggregate per
  transaction.
- Organize application behavior as feature-first vertical slices. Co-locate an
  operation's command, use case, and focused tests under
  `<feature>/<operation>`. Keep only genuinely cross-operation contracts and
  helpers under `<feature>/shared`, and keep feature-wide ports and stable
  errors at the feature root. Do not use a generic `commands/<feature>` folder
  as a container for mixed application roles.
- Commands are immutable classes with `fromRequest()` factories. The factory
  accepts an application-owned structural input contract, immediately converts
  transport strings to domain value objects, and keeps the resulting command
  free of raw dates and decimal strings. Commands never import infrastructure
  request DTO classes.
- Application ports are abstract classes when they are Nest injection tokens.
  They may extend shared contracts but cannot expose ORM or transport types.
- Keep command repositories narrow: aggregate lookup and persistence only. Do
  not add list, count, existence, or read-model helpers.
- Prefer database constraints for simple uniqueness rules and map persistence
  failures to stable application errors.
- Application services orchestrate application concerns and depend on ports,
  not concrete adapters.

## Errors and results

- Expected domain and application failures use `AppError` or a subtype;
  domain-specific failures extend `DomainError`.
- Keep error codes stable. `AppError` carries a code, message, kind, optional
  metadata, and optional cause.
- Return `Result<T, E extends AppError>` for meaningful expected failures from
  external input, use cases, domain or application services, repository
  operations, and external integrations. Do not force `Result` onto trivial
  pure methods.
- A missing command-side aggregate is an error. Nullable values remain valid in
  read models when absence is data rather than a failed operation.

## Domain events

Domain events are immutable, versioned, past-tense classes. They include event
identity, occurrence time as `UtcInstant`, aggregate identity and type, logical
context, and scalar payload data. Do not put entities, value objects, or ORM
objects in event payloads.

Use `$investflow-eventing` when a change also affects outbox persistence,
publication, broker routing, or consumers.

## Tests

Place focused `*.spec.ts` files beside the source. Cover factories, invariants,
state transitions, event emission, error paths, and deterministic temporal
behavior. Run the affected domain and application Nx test and lint targets;
broaden validation when public contracts or dependency boundaries change.
