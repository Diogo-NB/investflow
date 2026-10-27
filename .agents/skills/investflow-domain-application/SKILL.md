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

## Model review

Review the domain model before changing its shape, not only the behavior you
add. The test is whether a developer seeing the types for the first time can
tell what each one means and how they relate. Prefer understandability over a
minimal diff: when adding to an existing type would leave it unclear, remodel
it.

- **Speak the ubiquitous language.** Map the product terms in the PRD (pt-BR)
  to type names before writing code. Each business concept becomes a named
  type, not a field in a generic container. For example, rendimento
  (earnings in R$) and rentabilidade (rate of return) are different
  concepts, and bruto/líquido (gross/net) are two outcomes of the same
  investment.
- **Group by the question the business asks.** Put together what answers
  one question, such as "what do I get at maturity, gross or net?", rather
  than what one step happened to compute. Avoid catch-all names such as
  `summary`, `data`, `info`, or `details`, and flat interfaces that mix
  concerns.
- **Keep one source per fact.** Derive what follows from other state in a
  factory or getter (net from gross minus taxes, rates from amounts and
  term, counts from collections), and enforce the relationship as an
  invariant. A stored copy needs a reason that belongs to the domain.
  Storage needs such as sorting or aggregation belong to persistence and
  never shape the domain type.
- **Check names for collisions.** Before reusing a name such as `Rate`,
  `Calculation`, or `Result`, look up what it already means in the context.
  Pick a distinct name when the meaning differs.
- **Treat extension as a trigger.** Adding fields to an existing type means
  re-reading the whole type against these rules. When the model no longer
  reads clearly, restructure it in the same change: rename, split, or derive
  instead of appending.

- **Carry per-type variation in one place.** When behavior varies by a type
  such as title type or remuneration kind, do not scatter `switch` or `if`
  branches across services. Put the variation in data or an existing policy
  object first; reach for a strategy, rules table, or null object only when
  the variation justifies it, and do not add a class per type when data is
  enough.

When planning, state the model before the file list: the types, the
vocabulary mapping, what is stored versus derived, and which pattern (if any)
carries per-type variation and why it is the minimum.

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
  such as `offers` or `simulations`. Do not organize domain by technical type while
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
- Operations with different triggers or inputs are separate commands and use
  cases, even when their steps look alike. Do not merge them behind a
  discriminated command (`{ kind: 'OFFER' | 'CURVE', id }`), several factories
  on one command, or a mode flag to avoid a few duplicated lines: the caller
  already knows which operation it wants, and the merge makes the use case
  decide it again.
- Organize application behavior as feature-first vertical slices. Co-locate an
  operation's command, use case, and focused tests under
  `<feature>/<operation>`. Keep only genuinely cross-operation contracts and
  types under `<feature>/shared`, and keep feature-wide ports and stable
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
  not add list, count, existence, or read-model helpers. One exception: a
  criteria lookup that returns the ids of the repository's own aggregates for
  a command-side flow, such as a fan-out acting on every simulation that uses
  an offer (`idsUsingOffer()`). It is the collection answering which members
  match, by reference so the flow loads no aggregates. Anything a screen
  reads stays in a query handler.
- Prefer database constraints for simple uniqueness rules and map persistence
  failures to stable application errors.
- Application services orchestrate application concerns and depend on ports,
  not concrete adapters.
- Never extract small functions into dedicated files to share them between use
  cases (see "Coding Conventions" in `AGENTS.md`). A rule belongs to its
  aggregate, value object, or domain service; a capability several services
  need belongs on a port; a type that several commands build owns its factory
  as a static method. Inline one-line
  lookups, such as `id ? repository.findById(id) : Result.ok(null)` read with
  `valueOrNull`.
- Presentation queries live in infrastructure and own operation-specific plain
  output contracts and record mapping in their handler files. Do not introduce
  application read-model ports or load aggregates solely to render responses.
  Use `$investflow-nestjs-infrastructure` for query outputs and optional
  transport presenters; domain and application temporal APIs still use the
  shared temporal value objects.

## Errors and results

- Expected domain and application failures use `AppError` or a subtype;
  domain-specific failures extend `DomainError`.
- Keep error codes stable. `AppError` carries a code, message, kind, optional
  metadata, and optional cause. The code is required and comes from the single
  `EAppErrorCode` enum in `@investflow/shared-domain`; add new codes there,
  under their owner's group, and never pass string literals.
- `AppError.message` is the user-facing explanation, in concise pt-BR. Clients
  show it as is. Keep it safe (no ids, class names, or internals), say what is
  wrong without naming screens or buttons, and write dates as DD/MM/AAAA
  (`CalendarDate.toPtBrString()`). The `code` is the contract that code branches
  on, and specs assert codes and metadata rather than message text.
- Return `Result<T, E extends AppError>` for meaningful expected failures from
  external input, use cases, domain or application services, repository
  operations, and external integrations. Do not force `Result` onto trivial
  pure methods.
- Prefer `Result.fromThrowable()` for synchronous operations that can throw
  and `Result.fromPromise()` for asynchronous operations that can reject,
  instead of repetitive `try/catch` blocks that only convert exceptions into
  Results. Map exceptions to the appropriate typed `AppError`.
- `Result` has no `andThen()`. Sequence dependent steps with guard clauses
  (`if (result.isErr()) return result;`, then use `result.value`) and return
  expected failures with `Result.err()`. Use `map()` and `mapError()` only for
  single, non-failing transformations. Keep throwing operations inside the
  helper callback: `map()` does not catch exceptions thrown by its callback.
- Let repository and service Results flow unchanged; do not re-wrap them in
  ad hoc unions (`{ value } | { missing }`) or nested Results. When a caller
  treats some failures differently (a deleted premise becomes an outcome,
  a technical failure is retried), branch once where it decides, on the
  shared error hierarchy (`error instanceof NotFoundError`), not on each
  concrete subtype. A step that loads several aggregates returns one Result
  of all of them, short-circuiting on the first error.
- Shape use cases so each case is decided once. If the same discriminant is
  checked twice (`'missing' in x` before and after a step), split the flow
  into early-returning paths and move the shared tail (record, save, map a
  stale write) into a private method both paths call. Review your own use
  case for this before presenting it.
- A missing command-side aggregate is an error. Nullable values remain valid in
  read models when absence is data rather than a failed operation.

## Domain events

Domain events are immutable, versioned, past-tense classes. They include event
identity, occurrence time as `UtcInstant`, aggregate identity and type, logical
context, and scalar payload data. Do not put entities, value objects, or ORM
objects in event payloads.

Name each event after the business fact, never a generic `<Aggregate>Changed`
or `<Aggregate>Updated`. Split an aggregate's changes into separate events
when consumers must react differently to them: an offer's terms change
recalculates simulations, while a renamed offer does not, so they are
`OfferTermsChanged` and `OfferDetailsChanged`. Consumers subscribe to the
facts they care about instead of filtering a generic event.

Use `$investflow-eventing` when a change also affects outbox persistence,
publication, broker routing, or consumers.

## Tests

Place focused `*.spec.ts` files in a `test/` folder beside the source, or beside the source itself when the folder would hold a single file. Cover factories, invariants,
state transitions, event emission, error paths, and deterministic temporal
behavior. Run the affected domain and application Nx test and lint targets;
broaden validation when public contracts or dependency boundaries change.
