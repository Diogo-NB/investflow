# Project Structure And Coding Patterns

InvestFlow uses a NestJS modular monolith with Nx-enforced DDD layers. The
project standardizes structure so bounded contexts can grow without losing
clear ownership or import boundaries and can later move to separate deployment
hosts without relocating their business code.

## Applications And Libraries

Projects under `apps/` are deployable runtime hosts. They own the executable
entrypoint, Nest bootstrap, process lifecycle, global middleware and transport
configuration, and the selection of bounded contexts and adapters included in
that deployment. They should contain minimal business logic.

Feature groupings under `libs/<context>/` are business capabilities. The
top-level grouping represents one bounded context; its nested domain,
application, and infrastructure directories are separate Nx projects used to
enforce layer dependencies. An Nx library does not need to be shared by
multiple apps. `libs/shared` is the exception: it contains intentionally
cross-context building blocks and is not itself a bounded context.

The current topology combines independently deployable server and browser
applications:

```text
apps/api
└── AppModule
    ├── SharedInfrastructureModule
    ├── InvestmentSimulatorInfrastructureModule
    └── future bounded-context modules

apps/web
└── Keycloak authentication, shell, and welcome page
    └── lazy context routes (offer routes being rebuilt in libs/investment-simulator/web)
```

`apps/api` is the system composition root. It chooses the contexts deployed in
the process and configures global concerns. Each imported bounded-context Nest
module is a local composition root that registers its own controllers,
handlers, repository bindings, and other internal providers. App wiring means
selecting those public modules, not listing every context-local provider again.

The intended future topology adds deployment hosts without moving the context:

```text
apps/investment-simulator-service  -> libs/investment-simulator/*
apps/investment-simulator-lambda   -> libs/investment-simulator/*
```

A service or Lambda app imports only its owned context and the adapters needed
by that host. Contexts remain extractable by avoiding direct cross-context
imports, cross-context table access, and transactions spanning contexts.

## Runtime Portability

Domain projects are framework-free. They do not import NestJS, Prisma, AWS
SDKs, transport models, environment configuration, or process lifecycle APIs.
Application and infrastructure projects may use NestJS as needed, but they do
not decide whether they are hosted by a long-running server, API Gateway
Lambda, queue Lambda, or worker process.

Host-specific entrypoints and lifecycle configuration belong under `apps/`.
The host decides which HTTP controllers, message consumers, persistence
adapters, schedulers, and background publishers are active. A single
infrastructure module is acceptable while every host needs the same adapters.
When host profiles diverge, the context infrastructure project must expose
focused modules, for example HTTP, messaging, persistence, and background
publishing modules, so importing one concern does not activate another as a
side effect.

The current `SharedInfrastructureModule` and
`InvestmentSimulatorInfrastructureModule` are convenient composition modules
for `apps/api`; their existence does not imply that every future Lambda should
import them unchanged. In particular, scheduled outbox polling must be enabled
only by a host whose invocation and lifecycle model supports it.

## Layer And Context Layout

Bounded contexts live under `libs/<context>/` and are split into backend layer
projects plus an optional browser presentation project:

- `domain`: aggregates, entities, value objects, domain services, events, and
  domain errors.
- `application`: use cases, application services, listeners,
  and abstract-class ports.
- `infrastructure`: Nest modules, controllers, DTOs, Prisma repositories,
  query handlers, mappers, presenters, consumers, and logging adapters.
- `web`: React routes, feature components and hooks, browser API clients, and display
  types. Its public API exposes route definitions for a browser app to compose.

`apps/web` is the browser composition root. It owns authentication, the shell,
and a welcome page. Offer CRUD belongs in the lazy-loaded
`libs/investment-simulator/web` project, which is being rebuilt, and uses
relative `/api` requests. The development server proxies
those requests to `http://localhost:3000`; production hosting must route them
to the independently deployed NestJS API.

The component, state, HTTP, form, testing, and project-boundary conventions
are defined in [Frontend Patterns](./frontend-patterns.md).

Contexts do not import one another's internals directly. Cross-context
communication uses integration events or explicit versioned transport
contracts. Internal aggregates and domain events are not shared wire
contracts. Shared building blocks stay under `libs/shared`.

Nx platform tags keep browser projects from importing server projects and keep
server projects from importing browser projects. Domain, application,
infrastructure, and shared backend projects remain tagged `platform:server`.
InvestFlow has a single frontend app. Browser code stays in `apps/web` or its
owning `libs/<context>/web` project. Local folders and relative imports support
reuse within each project. Do not create reusable frontend libraries for types,
UI, data access, state, or utilities; `libs/shared` remains backend-only.

Pagination uses separate `PaginatedResult<Item>` interfaces with the same wire
shape: readonly `items`, `total`, one-based `page`, and `pageSize`. Backend code
imports from `@investflow/shared-types`; frontend code imports locally from
`libs/investment-simulator/web/src/lib/pagination/paginated-result.type.ts`.
Only the backend exports this interface through its public index; the frontend
contract remains internal to its web project. Do not import
one platform's contract into the other or introduce a cross-platform contract
package. Feature-specific item models remain owned by their respective context.

Repository-wide `pnpm build` and `pnpm check` intentionally include both
applications. Backend-only build and delivery pipelines use targeted API tasks
such as `pnpm build:api` or `pnpm nx run api:prune` so browser dependencies are
not pulled into the API artifact.

## Folder Taxonomy

Organize every bounded-context layer feature-first. The first directory below
`src/lib` is a stable, plural business feature such as `offers` or `issuers`.
Do not make one layer type-first while adjacent layers are feature-first.

Each layer applies its own structure below that common feature root:

- Domain keeps cohesive models shallow under `<feature>/`: aggregates,
  entities, value objects, domain errors, and their focused tests are
  co-located. Add role subfolders only when the feature is large enough that a
  flat directory is no longer readable.
- Application uses vertical operation slices such as
  `<feature>/<operation>/`. Co-locate the command, use case, and focused tests;
  put only cross-operation contracts and helpers in `<feature>/shared`, and
  keep feature-wide repository ports and stable errors at the feature root.
- Infrastructure groups adapters by boundary under the feature, such as
  `<feature>/http/` for controllers, request DTOs, HTTP validators, and
  presenters, and `<feature>/persistence/` for repositories and mappers. Add
  boundaries such as `messaging/` or `queries/` when the feature needs them.

For example:

```text
domain/src/lib/offers/
  offer.aggregate.ts
  offer-deleted.error.ts
  title-type.enum.ts
  terms/
    redemption/
      redemption-terms.vo.ts
      redemption-terms.vo.spec.ts
    remuneration/
      remuneration-terms.vo.ts
      remuneration-terms.vo.spec.ts

application/src/lib/offers/
  create/
  update/
  delete/
  shared/
  offer.repository.ts

infrastructure/src/lib/offers/
  http/
    offer.controller.ts
    offer.controller.spec.ts
    requests/
      create-offer.request.ts
      update-offer.request.ts
      offer-id.request.ts
      terms/
        offer-terms.request.ts
  persistence/
```

Context-wide composition modules and artifacts that genuinely coordinate more
than one feature may remain at `src/lib`.

Shared libraries follow the same navigation rule, using reusable capabilities
as their feature roots. For example, shared domain groups temporal primitives
and calendars under `dates` and decimal-rate behavior under `rates`; shared
infrastructure groups adapters under capabilities such as `authentication`,
`persistence`, `http`, and `messaging`. Do not fall back to global file-type
folders such as `value-objects`, `services`, `validators`, or `formatters` in
shared projects.

```text
shared/domain/src/lib/
  dates/
  foundations/
  rates/

shared/infrastructure/src/lib/
  authentication/
  dates/
  http/
  messaging/
    outbox/
    sqs/
  persistence/
    prisma/
```

Do not collect mixed operations in `commands/<feature>`, or split a single
feature across top-level `controllers`, `dtos`, `repositories`, and `mappers`
folders. Start navigation from the business feature, then from the operation
or technical boundary relevant to that layer.

HTTP input follows one direction: a class-validator request DTO under
`infrastructure/src/lib/<feature>/http` is converted by an application command
factory and then passed to its use case. Controllers only coordinate this
`Request DTO -> Command -> Use case` flow; they do not declare request classes
or contain request-mapping helper functions. Request DTOs implement structural
input contracts exported by application, while application commands never
import infrastructure classes.

Request DTOs do not need unit suites that enumerate built-in `class-validator`
decorators. Test custom validation rules in focused validator specs, controller
orchestration in controller specs, and request-to-command conversion in command
specs.

## File Naming

Use kebab-case filenames with a role suffix.

| Role                   | Suffix                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Controller             | `*.controller.ts`                                                         |
| Nest module            | `*.module.ts`                                                             |
| Listener or consumer   | `*.listener.ts`                                                           |
| DTO                    | `*.dto.ts`                                                                |
| HTTP request DTO       | `*.request.ts`                                                            |
| Guard                  | `*.guard.ts`                                                              |
| Decorator              | `*.decorator.ts`                                                          |
| Filter                 | `*.filter.ts`                                                             |
| Interceptor            | `*.interceptor.ts`                                                        |
| Strategy               | `*.strategy.ts`                                                           |
| Use case               | `*.use-case.ts`                                                           |
| Query handler          | `*.query-handler.ts`                                                      |
| Command                | `*.command.ts`                                                            |
| Query                  | `*.query.ts`                                                              |
| Repository             | `*.repository.ts`                                                         |
| Port                   | `*.port.ts`                                                               |
| Mapper                 | `*.mapper.ts`                                                             |
| Presenter              | `*.presenter.ts`                                                          |
| Aggregate              | `*.aggregate.ts`                                                          |
| Entity                 | `*.entity.ts`                                                             |
| Value object           | `*.vo.ts`                                                                 |
| Event                  | `*.event.ts`                                                              |
| Domain service         | `*.domain-service.ts`                                                     |
| Application service    | `*.application-service.ts`                                                |
| Infrastructure service | `*.service.ts`                                                            |
| Error                  | `*.error.ts`                                                              |
| Compile-time contract  | `*.contract.ts`                                                           |
| Type-only declaration  | `*.type.ts`                                                               |
| Base class             | `*.base.ts`                                                               |
| Registry               | `*.registry.ts`                                                           |
| Context                | `*.context.ts`                                                            |
| Test                   | mirror the source suffix, for example `create-portfolio.use-case.spec.ts` |

## Dependency Injection

Use abstract classes as Nest DI tokens. Do not use Symbol tokens for providers.
Interfaces are still useful for data shapes and compile-time contracts, but
they cannot be injected directly because TypeScript erases them at runtime.

```typescript
export abstract class PortfolioRepository {
  abstract save(portfolio: Portfolio): Promise<Result<void, AppError>>;
}
```

```typescript
@Module({
  providers: [CreatePortfolioUseCase, { provide: PortfolioRepository, useClass: PrismaPortfolioRepository }],
})
export class InvestmentSimulatorInfrastructureModule {}
```

Keep command-side repositories small. They should load aggregates needed by
commands and persist aggregate changes, not accumulate list, count, existence,
or read-model helpers. For simple uniqueness rules, prefer database constraints
and map persistence errors to stable application errors instead of adding a
pre-check service or repository existence method.

Query handlers live in infrastructure and may use `PrismaService` directly.
They should return read-oriented outputs or nullable data as appropriate and
must not load aggregates just to render API responses.

## Query Output Contracts

Each query handler owns its input and output contracts in its
`*.query-handler.ts` file. Use operation names such as `GetOfferQuery`,
`GetOfferOutput`, `ListOffersQuery`, and `ListOffersOutput`; name a list entry
`OfferListItem`. Keep the Prisma selection and its inferred record type local
to that file. Define consumer contracts explicitly rather than exporting
Prisma payload types or generated ORM enums.

The query output is the read model. A separate `*ReadModel` interface, file,
or intermediate representation is not required. Presentation reads return
plain data: civil dates are ISO strings, precise decimal values are strings,
and no native `Date`, Prisma Decimal, or domain value object escapes the
handler. Convert ORM dates through the shared temporal types before
serialization.

When conversion is needed, use a private `toOutput()` method in the handler.
Keep asynchronous lookup and synchronous mapping together inside
`Result.fromPromise()` so conversion failures become query errors as well.
When the selected fields already match the output contract, return them
directly without adding an identity mapper.

List and detail contracts evolve independently even when they initially have
the same fields. A feature-local projection helper can be extracted when
multiple queries deliberately share meaningful conversion behavior; avoid
forcing all reads into one universal entity shape.

Controllers return query Results directly; the host's global HTTP result
interceptor unwraps them. Presenters are optional and belong under the HTTP
boundary only when it needs a distinct representation, such as API-version
fields, links, or localized formatting. Basic date and decimal serialization
belongs in query mapping. Persistence mappers retain their separate
command-side responsibility of converting aggregates to and from ORM records.

## Screen-Oriented Queries (Backend For Frontend)

Decision dated 2026-10-10: complex screens, such as the simulation workspace,
read through queries designed for that screen. The bounded context's own
infrastructure serves them; there is no separate BFF service or layer.

In practice:

- Design the query handler from the screen's usage. Start from what the screen
  shows and decides, then shape the output contract for it: name it after the
  usage, include only the fields the screen uses, and compose related data the
  screen always needs together into one read instead of several round trips.
- Compute business facts on the server, where the rules live: eligibility
  ("can be calculated"), status flags ("outdated"), counts, and derived dates
  or periods. The browser must not re-implement domain rules to obtain values
  the screen displays or acts on.
- Keep outputs plain data under the usual contract rules: ISO dates, exact
  decimal strings, stable codes, and enums.
- This applies to reads. Commands and use cases stay shaped by the domain.
  Generic lookups (for example, the issuer list) remain fine when a screen
  uses them as they are; add a screen query when the screen needs shaping or
  composition.

What it does not mean:

- No backend-driven layout or UI schemas. The backend does not decide sections,
  ordering on the page, components, or visibility of UI elements.
- No render-ready generic structures (such as `{ type: 'card', fields: [...] }`)
  and no frontend components from the backend.
- No presentation formatting or copy: currency and date formatting, labels,
  messages, and translations stay in the frontend, which formats the exact
  values it receives.

Exception (2026-10-10): a calculation's tax explanation formulas (such as
"R$ 217,38 × 22,5% = R$ 48,91") are written out by the query projection from
the values the domain recorded, so the screen shows them as they are. The
projection only formats; the domain decides every value and the tax rules.

## Persistence Mappers

Persistence mappers convert ORM records into domain objects and domain objects
into persistence data. Keep ORM types and native `Date` values inside
infrastructure.

For optional repository records and mapped aggregates, prefer truthy
conditionals with the present-value branch first. For example, use
`return record ? OfferMapper.toDomain(record) : null;` when mapping a lookup.

When a value-object conversion returns a `Result`, access `.value` directly
at the mapping site. For example:

```typescript
CalendarDateRange.of(CalendarDate.fromUtcDate(record.startDate).value, CalendarDate.fromUtcDate(record.endDate).value);
```

Do not introduce helper functions or repeat `isErr()` / `throw result.error`
checks solely to unwrap these conversions. Persisted values are expected to
be valid. If a conversion fails, `.value` throws; the repository captures
lookup and mapping together inside `Result.fromPromise` and translates the
exception into `RepositoryFindError`.

## Results And Errors

Expected business and application failures use `Result<T, E extends AppError>`.
Use Result for meaningful failures from external input, use cases, domain and
application services, repository operations, and external integrations. Do not
force Result onto trivial pure methods.

Prefer `Result.fromThrowable()` for synchronous operations that can throw and
`Result.fromPromise()` for asynchronous operations that can reject, instead
of repeating `try/catch` blocks that only convert exceptions into Results.
Map exceptions to the appropriate typed `AppError`. For example:

```typescript
Result.fromThrowable(
  () => new Decimal(value),
  () => new InvalidIndexValueError('expected a decimal'),
);
```

`Result` deliberately has no `andThen()`. Sequence dependent steps with guard
clauses: `if (result.isErr()) return result;`, then continue with
`result.value`, and return expected failures with `Result.err()`. Use `map()`
and `mapError()` only for single, non-failing transformations. Keep throwing
operations inside the helper callback; `map()` does not catch exceptions
thrown by its callback.

Command-side repository ports return `Result` for aggregate lookup and
persistence. A missing aggregate is an error in that contract. Read/query
models and infrastructure query handlers may still use nullable values when
absence is just part of the returned data.

`AppError` carries a stable `code`, `message`, `kind`, optional `metadata`, and
optional `cause`. Domain-specific failures extend `DomainError`.

HTTP errors are translated centrally from `AppError.kind` and use this envelope:

```json
{
  "statusCode": 422,
  "code": "SOME_STABLE_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

Controllers return use-case Results directly. The API host registers
`TransactionInterceptor` followed by `HttpResultInterceptor` globally. The
transaction wraps result unwrapping so failed AppErrors trigger rollback before
reaching the central exception filter. `@SkipTransaction()` bypasses the
transaction but still unwraps Results. Ordinary responses pass through unchanged;
no raw Result is serialized into an HTTP response. Success responses contain the
returned values without a generic envelope. PrismaModule supplies persistence
providers; the API host owns global HTTP interceptor activation and ordering.

## Class Design

Aggregates and entities store state in private props objects, expose getters,
and mutate only through behavior methods. Use static factories for creation and
reconstitution.

The domain owns identity generation. Aggregate and entity `create()` factories
do not accept an ID; they call `generateUuid()` from `@investflow/shared-domain`,
which uses UUID v4 from the `uuid` package. Only `reconstitute()` accepts an
existing ID when restoring persisted state. Tests that need a known identity
use `reconstitute()` rather than injecting an ID into `create()`.

`createdAt` and `updatedAt` are not mandatory domain fields. Keep technical
audit timestamps in persistence models and omit them when reconstituting an
aggregate unless a business invariant, transition, or calculation depends on
them. Likewise, a behavior method receives the current instant only when that
instant affects domain state or a domain event; do not add time parameters only
to mirror database auditing.

Value objects use private constructors, static factories, and value equality.
Factories that accept validated value objects, enums, or constrained literal
unions use those precise types and return the new object directly unless an
additional business invariant can fail. Do not widen those inputs to `unknown` or repeat runtime type checks;
for example, `RemunerationTerms.create('PREFIXED', rate)` returns
`RemunerationTerms` directly.

`RemunerationTerms` is a single value object containing a kind and a `Rate`.
Its `create(kind, rate)` factory returns the object directly, and equality
compares both fields. The domain interprets the rate according to the kind.
Factories fed by external input should expose `create()` returning Result when
validation failure is an expected flow. Keep `of()` only as an internal throwing
convenience when useful. Throw typed domain errors only for internal invariant
breaches.

Domain events are immutable versioned classes with `eventType`, `version`,
`context`, aggregate identity, timestamps, and scalar payload data.

## Imports

Each library exports its public API from `src/index.ts`. Cross-project imports
use public aliases such as `@investflow/shared-domain`. Relative imports are
used only inside the same Nx project.

## Deferred Work

Work that was consciously postponed but must still be implemented. Each item
says why it was deferred, what exists today, and what "done" means. Remove an
item when it ships.

### Cache non-business-day reads (deferred 2026-10-10)

`GET /investment-simulator/business-calendar/non-business-days?year=` computes
a year's weekends and holidays on every request.

- **Today:** the browser keeps each year for the session (TanStack Query,
  `staleTime: Infinity`). The API recomputes the year on each call and sends no
  cache headers, so every new session, tab, or user repeats the work and the
  request.
- **Why deferred:** the computation is small (one pass over 365 days) and
  correctness came first.
- **Done means:**
  - The API serves a year from a server-side cache (computed once per process,
    or kept in a shared cache when several instances run).
  - Responses carry HTTP caching headers. They are bearer-authenticated, so
    use `Cache-Control: private` with a long `max-age` plus an `ETag`, so
    browsers revalidate cheaply.
  - The cache key includes a version of the calendar rules. A change to the
    holiday rules (a new national holiday, an ANBIMA calendar change) must
    invalidate cached years instead of serving stale dates.
  - Tests cover cache hits, the headers, and invalidation on a rules version
    change.

### Shared compute-once helper for in-call caches (deferred 2026-10-10)

`InvestmentCalculator` caches daily accrual factors per rate in a local `Map`
during one `calculate()` call, with an inline get-or-compute-and-store block.
More calculators and curve conversions are expected to need the same pattern.

- **Today:** the block is written inline in `investment-calculator.domain-service.ts`
  (`accrue()`); it is the only use.
- **Why deferred:** one call site does not justify a shared utility yet.
- **Done means:**
  - `@investflow/shared-domain` exports a `getOrInsertComputed(map, key,
    compute)` function in a capability folder (such as `collections/`),
    shaped like the TC39 `Map.prototype.getOrInsertComputed` proposal so it
    can be replaced by the native method once Node ships it.
  - The caller keeps owning the map, its lifetime (one calculation, never a
    long-lived service), and the key (`Decimal` values are keyed by string).
  - No `memoize(fn)` wrapper that hides where the cache lives.
  - The calculator and the new call sites use it, with a focused spec.
