---
name: investflow-domain-application
description: Implement, review, or refactor InvestFlow domain and application code. Use for aggregates, entities, value objects, domain services, use cases, commands, application services, ports, expected errors, Results, temporal behavior, or domain-focused tests, and whenever a change edits files under libs/*/domain or libs/*/application. Load investflow-eventing too when the change raises or records an event. Do not use for infrastructure-only NestJS or Prisma work or frontend work.
---

# InvestFlow Domain and Application

Model business behavior explicitly while keeping the domain independent of
frameworks and deployment concerns.

## Start

Inspect the affected `libs/<context>/domain` and `libs/<context>/application`
projects, their `src/index.ts`, the shared domain and application primitives
they use, and nearby tests. Read the PRD sections for the business rules you
touch (`docs/README.md` lists the product docs), and
`docs/architecture/recalculation.md` before changing offers, curves, or
simulations.

## Model review

Review the domain model before changing its shape, not only the behavior you
add. The test is whether a developer seeing the types for the first time can
tell what each one means and how they relate. Prefer understandability over a
minimal diff: when adding to an existing type would leave it unclear, remodel
it.

- **Speak the ubiquitous language.** Map the PRD's pt-BR terms to type names
  before writing code. Each business concept becomes a named type, not a
  field in a generic container: rendimento (earnings in R$) and rentabilidade
  (rate of return) are different concepts, and bruto/líquido (gross/net) are
  two outcomes of the same investment.
- **Group by the question the business asks.** Put together what answers one
  question, such as "what do I get at maturity, gross or net?", rather than
  what one step happened to compute. Avoid catch-all names such as `summary`,
  `data`, `info`, or `details`, and flat interfaces that mix concerns.
- **Keep one source per fact.** Derive what follows from other state in a
  factory or getter (net from gross minus taxes, rates from amounts and term,
  counts from collections), and enforce the relationship as an invariant. A
  stored copy needs a reason that belongs to the domain. Storage needs such as
  sorting or aggregation belong to persistence and never shape the domain
  type.
- **Check names for collisions.** Before reusing a name such as `Rate`,
  `Calculation`, or `Result`, look up what it already means in the context.
- **Treat extension as a trigger.** Adding fields to an existing type means
  re-reading the whole type against these rules; rename, split, or derive
  instead of appending.
- **Carry per-type variation in one place.** When behavior varies by a type
  such as title type or remuneration kind, do not scatter `switch` or `if`
  branches across services. Put the variation in data or an existing policy
  object first; reach for a strategy, rules table, or null object only when
  the variation justifies it. When only some aggregates need a capability
  (such as a revision), make it a pluggable concept with a fixed variant
  rather than a nullable field checked everywhere.
- **Prefer the smallest model.** A column or a derived value before a new
  aggregate, status, or table (an issuer is an `issuerName`, not an
  aggregate with its own CRUD). Delete behavior nothing uses.

When planning, state the model before the file list: the types, the
vocabulary mapping, what is stored versus derived, and which pattern (if any)
carries per-type variation and why it is the minimum.

## Layers and organization

- Domain code never imports NestJS, Prisma, AWS SDKs, transport types,
  configuration, or process APIs. Application code may use NestJS decorators
  but never a host or an infrastructure implementation.
- Use the same plural feature root in every layer (`offers`, `simulations`).
  Keep a domain feature shallow under `domain/src/lib/<feature>`: aggregate,
  entities, value objects, domain errors, and tests together; add role
  subfolders only when a flat directory stops being readable.
- Under `application/src/lib/<feature>`, use one vertical slice per operation
  (`<feature>/<operation>`: command, use case, tests). Feature-wide ports and
  stable errors sit at the feature root; `<feature>/shared` holds only
  contracts used by several operations.

## Domain objects

- Aggregates extend `AggregateRoot` and entities keep state in a
  `private readonly props` object with getters, changed only through behavior
  methods. Mark a props field `readonly` only when it never changes after
  creation (an owner, a curve's index, an offer's title type); behavior
  methods assign the other fields directly instead of rebuilding `props` with
  a spread. Factories hand the constructor a fresh object, never one the
  caller keeps.
- Aggregates provide static `create()` and `reconstitute()`. `create()` never
  accepts an ID: the domain generates it with `generateUuid()`. Only
  `reconstitute()` takes an existing ID, and tests that need a known identity
  use it.
- A behavior method receives the current instant only when it affects state
  or an event.
- Value objects extend `ValueObject<T>`, use private constructors and static
  factories, validate on creation, and compare by value. Immutability relies
  on readonly state: no `Object.freeze` and no tests that bypass TypeScript to
  check it.
- Factories accept precise domain types (validated value objects, enums,
  literal unions) and return the object directly when no further invariant
  can fail: `RemunerationTerms.create('PREFIXED', rate)` returns
  `RemunerationTerms`. Do not widen inputs to `unknown`, add redundant
  `instanceof` checks, or return `Result` only to check types. Use
  `create()` returning `Result` when failure is expected from external
  input; keep throwing `of()` helpers internal and throw a typed
  `DomainError` only for an invariant breach.
- Give value objects the behavior their callers need instead of computing on
  their raw parts at each call site: `instant.addMs(delay)`, not arithmetic
  on `epochMilliseconds`; `range.datesBetween`, not a date loop in a service.
  Expose argument-free facts as getters (`isWeekend`), and cache an expensive
  computed getter on an immutable object.
- Put a value object in shared domain only when its semantics are reusable
  across contexts.
- Domain services hold calculations that do not belong to one aggregate or
  value object. An aggregate method that receives other aggregates, carries
  heavy logic, or needs another domain service is a domain service in
  disguise; extract it. A stateless domain service with no dependencies (such
  as `BusinessDayCalendar`) may be static.

## Time

- No native `Date`, timestamps, or ad hoc date strings in commands, ports,
  services, or events. Parse transport values once at the entry boundary,
  serialize them only at output, and extend a shared temporal value object
  when reusable behavior is missing.
- `Clock.now()` gives the current instant and `Clock.today()` the current UTC
  date; pass time into domain behavior explicitly.

## Application orchestration

- Use cases expose one `execute(command)` method and modify one aggregate per
  transaction.
- Operations with different triggers or inputs are separate commands and use
  cases, even when their steps look alike. Do not merge them behind a
  discriminated command (`{ kind: 'OFFER' | 'CURVE', id }`), several
  factories on one command, or a mode flag: the caller already knows which
  operation it wants.
- Commands are immutable classes with `fromRequest()` factories that accept
  an application-owned structural input contract and immediately convert
  transport strings to value objects. Commands never import infrastructure
  request DTO classes.
- Ports are abstract classes (they are Nest injection tokens) and never
  expose ORM or transport types. A port names a capability, not a
  technology.
- Command repositories do aggregate lookup and persistence only, no list,
  count, existence, or read-model helpers. The one exception is a criteria
  lookup returning the ids of the repository's own aggregates for a
  command-side flow, such as a fan-out (`idsUsingOffer()`). Anything a screen
  reads is a query handler in infrastructure; never load aggregates to render
  a response.
- Prefer database constraints for simple uniqueness rules and map their
  failures to stable application errors.
- A rule belongs to its aggregate, value object, or domain service; a
  capability several services need belongs on a port; a type several commands
  build owns its factory as a static method (see the small-functions rule in
  `AGENTS.md`).

## Errors and Results

- Expected failures use `AppError` or a subtype; domain failures extend
  `DomainError`. Every code is a member of `EAppErrorCode` in
  `@investflow/shared-domain`, added under its owner's group; never string
  literals.
- `AppError.message` is concise, safe pt-BR shown to users as is: no ids,
  class names, or internals, no screen or button names, dates as DD/MM/AAAA
  (`CalendarDate.toPtBrString()`). Code branches on `code`; specs assert codes
  and metadata, not message text.
- Return `Result<T, E extends AppError>` for meaningful expected failures
  from external input, use cases, services, repositories, and integrations,
  not from trivial pure methods. Prefer `Result.fromThrowable()` and
  `Result.fromPromise()` over `try/catch` blocks that only convert
  exceptions.
- `Result` has no `andThen()`. Sequence steps with guard clauses
  (`if (result.isErr()) return result;`). Use `map()` and `mapError()` only
  for single non-failing transformations; `map()` does not catch exceptions
  from its callback. Read optional lookups with `valueOrNull`, inline:
  `id ? repository.findById(id) : Result.ok(null)`.
- Prefer a `Result` over a boolean for an operation that can fail, so the
  caller gets the error instead of guessing why.
- Let Results flow unchanged; do not re-wrap them in ad hoc unions
  (`{ value } | { missing }`) or nested Results. When a caller treats some
  failures differently, branch once where it decides, on the shared hierarchy
  (`error instanceof NotFoundError`). A step that loads several aggregates
  returns one Result of all of them.
- Shape use cases so each case is decided once. If the same discriminant is
  checked twice, split the flow into early-returning paths and move the
  shared tail into a private method.
- A missing command-side aggregate is an error; nullable values stay valid in
  read models when absence is data.

## Domain events

`investflow-eventing` owns event design: which facts become events, their
names, payloads, and consumers, and the event catalog. Load it whenever a
change adds, changes, or removes an event, or makes an aggregate or service
raise or record one.

## Before finishing

Review your own diff for the mistakes this codebase has had to correct:

- An aggregate method that takes other aggregates or another domain service
  (a domain service in disguise).
- One operation hidden behind a `kind`, a mode flag, or several factories.
- A stored field that could be derived, or a new aggregate or table where a
  column works.
- A generic name (`data`, `summary`, `Changed`) or one that collides with an
  existing type.
- The same discriminant checked twice in one flow, or Results re-wrapped.
- A boolean success flag where a `Result` says why it failed.
- Behavior added for later that nothing uses.

## Tests

Place focused `*.spec.ts` files in a `test/` folder beside the source, or
beside it when the folder would hold one file. Cover factories, invariants,
state transitions, event emission, error paths (asserting codes), and
deterministic temporal behavior. Finish with the checks for domain and
application in "Done means" in `AGENTS.md`.
