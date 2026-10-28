---
name: investflow-nestjs-infrastructure
description: Implement, review, or refactor InvestFlow NestJS and Prisma infrastructure. Use for controllers, DTOs, repositories, query handlers, mappers, presenters, Nest modules, dependency injection, Prisma schema and migrations, shared infrastructure, host composition, or backend Nx project placement, and whenever a change edits files under libs/*/infrastructure or apps/api. Load investflow-eventing too when the change touches consumers, the outbox, or the unit of work. Do not use for domain-only modeling or frontend work.
---

# InvestFlow NestJS Infrastructure

Keep technical adapters owned by their bounded context and deployable apps as
thin composition roots.

## Start

Inspect the affected infrastructure project, its `project.json` and
`src/index.ts`, the application ports it implements, the consuming app, and
the Prisma schema or shared adapters involved. Read
`docs/architecture/project-structure.md` before adding a project, folder, or
file kind (its "Folder Taxonomy" and "File Naming" are the reference for
role suffixes), and `docs/architecture/queries.md` before designing what a
screen reads.

## Ownership and composition

- A `libs/<context>/` grouping is one bounded context; its domain,
  application, and infrastructure directories are layers.
- Context infrastructure owns controllers, DTOs, repositories, query
  handlers, mappers, presenters, consumers, provider bindings, and external
  adapters. Its module is the context's composition root and the public
  module hosts import.
- Projects under `apps/` own bootstrap, global transport configuration,
  process lifecycle, and the selection of context modules and active
  adapters; they never enumerate a context's internal providers.
- Shared infrastructure supplies cross-context adapters and never depends on
  feature contexts.
- Group adapters by boundary below the feature root:
  `<feature>/http` (controllers, request DTOs, HTTP validators, presenters),
  `<feature>/persistence` (repositories, mappers), and `messaging` or
  `queries` when needed. Shared infrastructure is capability-first
  (`authentication`, `clocks`, `http`, `messaging/eventbridge`,
  `persistence/prisma`); never global `controllers`, `dtos`, `filters`, or
  `validators` folders.

## Dependency injection and handlers

- Abstract classes are the Nest provider tokens
  (`{ provide: OfferRepository, useClass: PrismaOfferRepository }`); never
  Symbol tokens. Interfaces stay for data shapes, since TypeScript erases
  them.
- Controllers and consumers inject use-case and query-handler classes
  directly. Handlers are plain classes with one `execute(input)` method: no
  command or query buses and no `@nestjs/cqrs`.

## Persistence

- Command repositories implement application ports and extend
  `BaseRepository`; only `BaseRepository` reads and clears aggregate events.
  They do aggregate lookup and persistence only.
- ORM records stay inside infrastructure. Mappers convert records to and
  from domain objects; native `Date` lives only at the ORM, driver, or
  `Intl` boundary and is converted at once.
- In mappers, unwrap Result-returning value-object conversions inline
  (`CalendarDate.fromUtcDate(record.startDate).value`), without helpers or
  repeated `isErr()` checks: persisted values are valid, and a failure throws
  inside the repository's `Result.fromPromise`.
- Columns that exist only for querying (sorting, filtering, aggregation) are
  a read model: the mapper writes them from the domain object, `toDomain()`
  never reads them back, and query handlers may read them. Document them in
  the schema; never add a domain field because a query needs a column.
- Wrap the lookup and its mapping in one `Result.fromPromise`, return the
  aggregate or `null` from the callback, then turn `null` into the
  not-found error. Returning `Result.err` inside the callback yields a
  successful Result holding an error.

  ```ts
  const offerResult = await Result.fromPromise(
    async () => {
      const record = await this.prisma.client.investmentOffer.findUnique({
        where: { id, deletedAt: null },
      });
      return record ? OfferMapper.toDomain(record) : null;
    },
    (error) => new RepositoryFindError('Offer', id, error),
  );
  if (offerResult.isErr()) return offerResult;
  return offerResult.value ? Result.ok(offerResult.value) : Result.err(new OfferNotFoundError(id));
  ```

  Declare the concrete error union in the return type
  (`Result<Offer, OfferNotFoundError | RepositoryFindError>`).

- Generate migrations with `pnpm db:migrate` against a running database;
  never assemble them from `migrate diff` or patch the generated SQL. Write
  SQL by hand only when Prisma cannot produce the change, only after the user
  approves, with a comment on each manual statement saying why.

## Query handlers

- Query handlers live in infrastructure, query Prisma directly, and never
  load aggregates. Each owns its input and output contracts in its
  `*.query-handler.ts` file, named by operation (`GetOfferQuery`,
  `GetOfferOutput`, `ListOffersOutput`, `OfferListItem`). The output is the
  read model: no separate `*ReadModel` files.
- Keep the Prisma selection and its inferred record type in the handler.
  Outputs are plain data: civil dates as ISO strings through `CalendarDate`,
  decimals as strings, no ORM types or enums, native `Date`, Decimal objects,
  or value objects.
- Map with a private `toOutput()` only when conversion is needed, inside
  `Result.fromPromise()` with the lookup; return selected records directly
  when they already match.
- List and detail contracts evolve independently; extract a feature-local
  projection only when several queries deliberately share meaningful
  mapping.
- Screen-oriented queries shape the output for the screen's usage and
  compute business facts (eligibility, status, counts, derived dates) on the
  server; never layout, UI structures, labels, or formatted values.
- A domain concept computed from several aggregates' state (a plan's status
  and totals) is built by an application read use case from a read port in
  domain terms; the handler calls the use case and serializes. Never select
  fields to fill a value object's inputs in a handler: that handler is the
  concept's domain service in disguise (`docs/architecture/queries.md`).

## HTTP boundary

- Request DTOs live in `<feature>/http` as `*.request.ts`, implement the
  application's structural input contract, and are validated before any use
  case runs. Never declare request classes or mapping helpers in controller
  files. The flow is request DTO, then `Command.fromRequest()`, then the use
  case.
- Validate civil dates with `@IsCalendarDate()`; never `@IsDate()` or a
  `YYYY-MM-DD` regular expression.
- Controllers return Results. The API host registers `TransactionInterceptor`
  then `HttpResultInterceptor` globally, so a failed Result rolls the
  transaction back before the exception filter; `@SkipTransaction()` skips
  the transaction but still unwraps. Raw Results are never serialized, and
  successes have no envelope.
- Presenters are optional, only for a distinct transport representation
  (versioned fields, links, localized formatting).
- `AppError.kind` maps centrally to HTTP status. Errors answer
  `{ statusCode, code, message, details }`; `AppExceptionFilter` replaces
  5xx messages with a generic one and logs the original. Request validation
  answers 400 `REQUEST_INVALID` listing `details.fields`.
- Keep Keycloak roles as generic strings until a domain rule needs specific
  ones.

## Ports and ownership

Before adding a parameter, check, or constant that crosses a port, decide
which side owns the knowledge, and say so in the plan:

- Provider facts (service names, quotas, SDK options) stay in the adapter.
  When the core needs a limit, it defines its own contract every adapter must
  accept, as the outbox does with its payload and batch limits
  (`message-broker.port.ts`); it never checks a provider's limit.
- The side that owns a policy passes it in: the outbox owns retries and
  shutdown, so it hands the broker an `AbortSignal` that the adapter honors.
- A port names a capability, not a technology.
- Writes to a table belong to the component that owns it (`outbox_events` to
  `messaging/outbox`), not to a base class that runs nearby.

## Runtime portability

- Infrastructure never assumes whether it runs in a long-lived server,
  Lambda, or worker. Entrypoints live under `apps/`.
- When hosts need different adapters, expose focused HTTP, messaging,
  persistence, or background-work modules; importing a module never starts
  work as a side effect.
- Preserve extraction boundaries: no cross-context internal imports, table
  access, or database transactions.

## Before finishing

- Every port parameter or limit sits on the side that owns it.
- No ORM type, native `Date`, or Decimal leaks out of a handler or
  repository.
- No repository grew a list, count, or existence helper.
- A boolean that reports success or failure is a `Result` instead.
- A new or changed query handler that serves a screen computes its business
  facts, not its formatting.
- No query handler builds domain value objects from records or decides which
  records a domain rule counts; a read port and use case do.

## Tests

Test custom validators and decorators directly and request mapping in
command tests; do not write suites that re-test built-in `class-validator`
decorators, and do not write controller specs unless a controller has
behavior no other test covers. Persistence round trips (precision, dates,
conditional updates) belong in `*.integration.spec.ts`. Finish with the
checks for infrastructure or persistence in "Done means" in `AGENTS.md`.
