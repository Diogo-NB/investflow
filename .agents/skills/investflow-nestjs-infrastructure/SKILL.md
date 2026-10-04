---
name: investflow-nestjs-infrastructure
description: Implement, review, or refactor InvestFlow NestJS and Prisma infrastructure. Use for controllers, DTOs, repositories, query handlers, mappers, presenters, Nest modules, dependency injection, shared infrastructure, deployment composition, or backend Nx project placement. Do not use for domain-only modeling, frontend work, or messaging-specific behavior.
---

# InvestFlow NestJS Infrastructure

Keep technical adapters owned by their bounded context and keep deployable apps
as thin composition roots.

## Start with the runtime boundary

Inspect the affected context infrastructure project, its `project.json` and
public `src/index.ts`, the corresponding application ports, the consuming app,
and relevant Prisma schema or shared adapters. Read
`docs/architecture/project-structure.md` before changing project structure,
module composition, host responsibilities, or library boundaries.

## Ownership and composition

- A top-level `libs/<context>/` grouping is one bounded context. Its domain,
  application, and infrastructure directories are layers, not independent
  contexts.
- Context infrastructure owns controllers, DTOs, repositories, query handlers,
  mappers, presenters, listeners, provider bindings, and external adapters.
- The context infrastructure module is its local composition root. It registers
  context-owned providers and exposes a public module for hosts to import.
- Projects under `apps/` own bootstrap, global transport configuration, process
  lifecycle, and the selection of context modules and active adapters. They do
  not enumerate a context's internal providers.
- Shared infrastructure supplies genuinely cross-context adapters and cannot
  depend on feature contexts.

## Feature-first organization

- Use the same plural business-feature root as domain and application, such as
  `offers` or `issuers`.
- Group adapters by boundary below that feature:
  `infrastructure/src/lib/<feature>/http` owns controllers, request DTOs, HTTP
  validators, and presenters; `<feature>/persistence` owns repositories and
  mappers. Add focused boundaries such as `messaging` or `queries` when needed.
- Keep the context composition module and only genuinely cross-feature
  artifacts at `src/lib`. Do not scatter one feature across top-level
  `controllers`, `dtos`, `repositories`, `mappers`, or `validators` folders.
- Organize shared infrastructure capability-first as well. Use cohesive roots
  such as `authentication`, `clocks`, `dates`, `http`, `messaging`, `money`,
  and `persistence`;
  place provider-specific boundaries beneath them when useful, for example
  `messaging/outbox`, `messaging/sqs`, and `persistence/prisma`. Do not recreate
  global role buckets such as `filters`, `presenters`, `validators`, or
  `formatters`; place a validator or formatter with the capability it serves.

## Dependency injection and handlers

- Use abstract classes as runtime Nest provider tokens. Do not use Symbol
  tokens for polymorphic providers.
- Interfaces remain valid for data shapes and compile-time contracts but cannot
  serve as Nest injection tokens.
- Controllers and listeners inject use-case or query-handler classes directly.
- Handlers are simple classes with one `execute(input)` method. Do not introduce
  command buses, query buses, or `@nestjs/cqrs` unless the task explicitly
  requires them.
- Shared compile-time handler contracts belong in
  `@investflow/shared-application`.

## Persistence and queries

- Concrete command repositories implement application ports and extend
  `BaseRepository`; only `BaseRepository` reads and clears aggregate domain
  events.
- Keep ORM records inside infrastructure. Mappers convert persistence records
  to and from domain objects.
- Query handlers live in infrastructure, query Prisma directly, and return
  read-oriented shapes without loading aggregates.
- Keep command repositories limited to aggregate lookup and persistence. Use a
  query handler for list, count, and presentation-oriented reads.
- Native `Date` may exist briefly at ORM, driver, framework, or `Intl`
  boundaries. Convert it immediately to or from the shared temporal types.

### Repository lookup Results

Prefer one `Result.fromPromise` around both the asynchronous lookup and its
synchronous domain mapping. Return the mapped aggregate or `null` from that
callback, and use `andThen` afterward to convert `null` into the application
not-found error. This catches database and mapper exceptions with the same
repository error mapping while keeping expected absence separate.

```ts
const offerResult = await Result.fromPromise(
  async () => {
    const record = await this.prisma.client.investmentOffer.findUnique({
      where: { id, deletedAt: null },
    });
    return record === null ? null : OfferMapper.toDomain(record);
  },
  (error) => new RepositoryFindError('Offer', id, error),
);

return offerResult.andThen((offer) =>
  offer === null ? Result.err(new OfferNotFoundError(id)) : Result.ok(offer),
);
```

The `fromPromise` callback returns a plain value; returning `Result.err` inside
it produces a successful outer Result containing an error Result.
Keep throwing mappers inside `fromPromise`: `map` and `andThen` do not catch
callback exceptions. Prefer the concrete error union in the method's return
type, such as `Result<Offer, OfferNotFoundError | RepositoryFindError>`.

## Transport boundaries

- Parse and validate transport input before invoking application behavior.
- Define decorated HTTP request DTOs in `infrastructure/src/lib/<feature>/http`
  with `*.request.ts` filenames. Never declare request classes or request-to-
  command mapping helpers in controller files.
- Follow `Request DTO -> Command -> Use case`: request DTOs implement the
  structural input contract owned by application, and controllers invoke the
  command's `fromRequest()` factory. Application commands must not import
  infrastructure request classes.
- Command factories immediately convert validated transport strings into
  domain value objects. Command instances expose domain types, not raw dates or
  decimal strings.
- Validate civil-date strings with the shared `@IsCalendarDate()` decorator;
  do not duplicate `YYYY-MM-DD` regular expressions or use `@IsDate()` for
  timezone-free calendar dates.
- Controllers unwrap `Result` at the transport boundary and never return a raw
  `Result`.
- Presenters map application or read models into response shapes.
- Map `AppError.kind` centrally to HTTP status codes. Error responses contain
  `statusCode`, stable `code`, human-readable `message`, and `details`;
  successful responses do not use a generic envelope.
- Keep Keycloak roles as generic strings. Introduce domain-specific roles only
  when a domain requirement needs them.

## Runtime portability

- Infrastructure must not assume whether it runs in a long-lived server,
  Lambda, queue worker, or another host.
- Keep EC2, Lambda, API Gateway, and worker entrypoints under `apps/`.
- When hosts need different adapters, expose focused HTTP, messaging,
  persistence, or background-work modules instead of activating them as import
  side effects.
- Preserve extraction boundaries: no cross-context internal imports, table
  access, or database transactions.

Use `$investflow-eventing` when infrastructure work affects domain-event
persistence, outbox polling, broker publication, or message consumers.

## Naming and validation

Follow the role suffixes and folder taxonomy documented in
`docs/architecture/project-structure.md`. Use public workspace aliases between
projects and relative imports within one project.

Do not create unit tests that enumerate request DTOs only to re-test built-in
`class-validator` decorators such as `@IsUUID()`, `@IsEnum()`, or
`@IsOptional()`. The library already covers those behaviors. Extract custom
validators and decorators into focused validator files and test those rules
directly. Test controllers for orchestration and commands for request mapping,
not for the internals of framework validation.

Run the affected infrastructure lint and test targets plus the consuming app's
build. Run `pnpm check` when project boundaries, shared configuration, or public
composition contracts change.
