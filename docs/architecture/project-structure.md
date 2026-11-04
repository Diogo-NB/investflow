# Project Structure

InvestFlow uses a NestJS modular monolith with Nx-enforced DDD layers. The
project standardizes structure so bounded contexts can grow without losing
clear ownership or import boundaries and can later move to separate deployment
hosts without relocating their business code.

This file is the structural reference: projects, layers, folders, file
names, and imports. The coding rules for domain objects, Results and errors,
dependency injection, persistence mappers, and query handlers are owned by the
layer skills in `.agents/skills/`.

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
    ├── PublishedIndexValuesHttpModule (market-data's endpoint)
    └── future bounded-context modules

apps/web
└── Keycloak authentication, shell, and welcome page
    └── lazy context routes from libs/investment-simulator/web (simulations; offers and curves next)

apps/index-values-importer (one run per schedule, exits when done)
└── ImporterModule
    ├── PrismaModule, ClockModule (no OutboxModule)
    └── PublishedIndexValuesImportModule
```

`libs/market-data` is a second bounded context: what the market published,
as facts. `investment-simulator` knows it only through
`libs/market-data/contracts`, tagged `scope:market-data-contracts` and
`layer:types`, and lint rejects any other import between the two. Market data
has one Nest module per host, so the API never loads the import job and the
importer never registers the endpoint.

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
import them unchanged. In particular, outbox publishing (the relay and its
polling fallback) must be enabled only by a host whose invocation and
lifecycle model supports it.

## Environment Configuration

Decided and built 2026-11-02: each backend capability declares the
environment variables it reads in its own `*.config.ts`, beside the module
that uses them, as a zod schema registered through `environmentConfig`
(`libs/shared/infrastructure/src/lib/config`). Importing the module registers
the config with `ConfigModule.forFeature`, so a host checks exactly the
capabilities it imports when it starts and fails with the variables at
fault; providers inject a typed object instead of reading strings. How to
add, inject, and debug a variable is in the `investflow-environment-config`
skill.

| Config        | Variables                                                                                                                            | Owner                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `database`    | `DATABASE_URL`                                                                                                                       | `persistence/prisma` (`PrismaModule`)    |
| `keycloak`    | `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`                                                                               | `authentication` (`AuthModule`)          |
| `aws`         | `AWS_REGION`                                                                                                                         | `aws`, for EventBridge and SQS           |
| `eventBridge` | `EVENT_BUS_NAME`                                                                                                                     | `messaging/eventbridge` (`OutboxModule`) |
| `outbox`      | `OUTBOX_POLL_MIN_INTERVAL_SECONDS`, `OUTBOX_POLL_MAX_INTERVAL_SECONDS`, `OUTBOX_RETENTION_INTERVAL_SECONDS`, `OUTBOX_RETENTION_DAYS` | `messaging/outbox` (`OutboxModule`)      |
| `sqsQueues`   | the queue URL variables named by the host's consumer bindings                                                                        | `messaging/sqs` (`SqsConsumersModule`)   |
| `server`      | `PORT` (default 3000), `LOG_LEVEL` (default `log`)                                                                                   | `apps/api`                               |

AWS credentials and `AWS_ENDPOINT_URL` are left to the AWS SDK's provider
chain, which also resolves profiles and IAM Roles Anywhere. The Prisma CLI
config, the CDK app, and the webpack config are not Nest code and read
`process.env` themselves.

Rejected:

- One schema for the whole environment, validated in
  `ConfigModule.forRoot({ validate })`: every host would need every
  variable (the seed Keycloak's, the benchmark the queue URLs'), or all
  would be optional and nothing would be checked.
- One schema assembled from per-capability parts that each host lists: it
  checks the same as the chosen design but needs a second list of each
  host's imports to keep in sync.
- `class-validator` classes, as in Nest's documentation: three decorators
  per variable, and checks across variables need custom validators.
- `ConfigService.getOrThrow` strings, as before: no types, formats,
  defaults, or single place stating what a host needs.

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
and a welcome page. Simulation, offer, and curve screens belong in the
lazy-loaded `libs/investment-simulator/web` project, which uses relative `/api`
requests. The development server proxies
those requests to `http://localhost:3000`; production hosting must route them
to the independently deployed NestJS API.

The frontend's structure and composition contract are in
[Frontend Patterns](./frontend-patterns.md); its coding rules are owned by
`investflow-react`.

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
`src/lib` is a stable, plural business feature such as `offers` or `simulations`.
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
  offer.error.ts
  offer.events.ts
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
  edit/
  duplicate/
  delete/
  shared/
  offer.repository.ts

infrastructure/src/lib/offers/
  http/
    offer.controller.ts
    offer.controller.spec.ts
    requests/
      create-offer.request.ts
      edit-offer.request.ts
      offer-id.request.ts
      terms/
        offer-terms.request.ts
  persistence/
  queries/
  offers.module.ts
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
    consumers/
    eventbridge/
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

| Role                   | Suffix                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| Controller             | `*.controller.ts`                                                               |
| Nest module            | `*.module.ts`                                                                   |
| Listener or consumer   | `*.listener.ts`                                                                 |
| DTO                    | `*.dto.ts`                                                                      |
| HTTP request DTO       | `*.request.ts`                                                                  |
| Guard                  | `*.guard.ts`                                                                    |
| Decorator              | `*.decorator.ts`                                                                |
| Filter                 | `*.filter.ts`                                                                   |
| Interceptor            | `*.interceptor.ts`                                                              |
| Strategy               | `*.strategy.ts`                                                                 |
| Use case               | `*.use-case.ts`                                                                 |
| Query handler          | `*.query-handler.ts`                                                            |
| Command                | `*.command.ts`                                                                  |
| Query                  | `*.query.ts`                                                                    |
| Repository             | `*.repository.ts`                                                               |
| Port                   | `*.port.ts`                                                                     |
| Mapper                 | `*.mapper.ts`                                                                   |
| Presenter              | `*.presenter.ts`                                                                |
| Aggregate              | `*.aggregate.ts`                                                                |
| Entity                 | `*.entity.ts`                                                                   |
| Value object           | `*.vo.ts`                                                                       |
| Event                  | `*.event.ts`                                                                    |
| Domain service         | `*.domain-service.ts`                                                           |
| Application service    | `*.application-service.ts`                                                      |
| Infrastructure service | `*.service.ts`                                                                  |
| Environment config     | `*.config.ts`                                                                   |
| Error                  | `*.error.ts`                                                                    |
| Compile-time contract  | `*.contract.ts`                                                                 |
| Type-only declaration  | `*.type.ts`                                                                     |
| Base class             | `*.base.ts`                                                                     |
| Registry               | `*.registry.ts`                                                                 |
| Context                | `*.context.ts`                                                                  |
| Test                   | mirror the source suffix, for example `create-investment-plan.use-case.spec.ts` |

## Imports

Each library exports its public API from `src/index.ts`. Cross-project imports
use public aliases such as `@investflow/shared-domain`. Relative imports are
used only inside the same Nx project.
