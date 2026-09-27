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
└── lazy route -> libs/investment-simulator/web
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
- `application`: use cases, query handlers, application services, listeners,
  and abstract-class ports.
- `infrastructure`: Nest modules, controllers, DTOs, Prisma repositories,
  query handlers, mappers, presenters, consumers, and logging adapters.
- `web`: Angular routes, feature components, browser API clients, and display
  types. Its public API exposes route definitions for a browser app to compose.

`apps/web` is the browser composition root. It lazy-loads context-owned web
projects and sends relative `/api` requests. The development server proxies
those requests to `http://localhost:3000`; production hosting must route them
to the independently deployed NestJS API.

The component, state, HTTP, form, testing, and library-extraction conventions
are defined in [Frontend Patterns](./frontend-patterns.md).

Contexts do not import one another's internals directly. Cross-context
communication uses integration events or explicit versioned transport
contracts. Internal aggregates and domain events are not shared wire
contracts. Shared building blocks stay under `libs/shared`.

Nx platform tags keep browser projects from importing server projects and keep
server projects from importing browser projects. Existing domain, application,
infrastructure, and shared projects are intentionally tagged
`platform:server`; they are not platform-neutral contracts.

Repository-wide `pnpm build` and `pnpm check` intentionally include both
applications. Backend-only build and delivery pipelines use targeted API tasks
such as `pnpm build:api` or `pnpm nx run api:prune` so Angular dependencies are
not pulled into the API artifact.

## Folder Taxonomy

Use loose type-first folders inside each layer. Add feature subfolders as a
folder grows.

Domain folders:

- `aggregates/<feature>`
- `entities/<feature>`
- `value-objects/<feature>`
- `events/<feature>`
- `services/<feature>`
- `errors/<feature>`
- `utils`

Application folders:

- `commands/<feature>`
- `queries/<feature>`
- `ports/<feature>`
- `services/<feature>`
- `listeners/<feature>`
- `errors/<feature>`

Infrastructure folders:

- `controllers/<feature>`
- `dtos/<feature>`
- `repositories/<feature>`
- `query-handlers/<feature>`
- `mappers/<feature>`
- `presenters/<feature>`
- `listeners/<feature>`
- `logging`

## File Naming

Use kebab-case filenames with a role suffix.

| Role                   | Suffix                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Controller             | `*.controller.ts`                                                         |
| Nest module            | `*.module.ts`                                                             |
| Listener or consumer   | `*.listener.ts`                                                           |
| DTO                    | `*.dto.ts`                                                                |
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
They should return read-oriented models or nullable data as appropriate and
must not load aggregates just to render API responses.

## Results And Errors

Expected business and application failures use `Result<T, E extends AppError>`.
Use Result for meaningful failures from external input, use cases, domain and
application services, repository operations, and external integrations. Do not
force Result onto trivial pure methods.

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

Success responses return presenter DTOs directly.

## Class Design

Aggregates and entities store state in private props objects, expose getters,
and mutate only through behavior methods. Use static factories for creation and
reconstitution.

Value objects use private constructors, static factories, and value equality.
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
