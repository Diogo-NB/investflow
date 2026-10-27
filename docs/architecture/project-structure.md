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
    └── lazy context routes from libs/investment-simulator/web (simulations; offers and curves next)
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
and a welcome page. Simulation, offer, and curve screens belong in the
lazy-loaded `libs/investment-simulator/web` project, which uses relative `/api`
requests. The development server proxies
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
  Generic lookups (for example, the offer list) remain fine when a screen
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

## Mutable Premises And Asynchronous Recalculation

Decision dated 2026-10-11: offers and index curves are deliberately mutable,
simulations always reference them, and results are recalculated
asynchronously when anything they depend on changes. This replaces the
earlier immutable model (copied offer terms, immutable curves, and an
append-only calculation history kept for reproducibility). Product rules are in
`docs/product/investment-simulator-prd.md` and
`docs/product/index-value-curves.md`.

**Status:** partly implemented. Curves and offers are built on this model:
independent `Curve` and `Offer` aggregates with owners, revisions, and events
in the outbox. `Simulation` references an offer and an optional curve, has its
own revision, and keeps one current `SimulationResult` recording the
simulation, offer, and curve revisions and the methodology version it used;
"Digitar termos" and "Duplicar e ajustar" create a private offer in the same
request. A simulation's own calculation is asynchronous (D4a): saving
validates, stores `PENDING`, and the `simulation-calculations` consumer
calculates; a dead-letter consumer records `FAILED`. Offer and curve changes
recalculate the simulations that use them (D4b, built 2026-10-26). The design
below was settled on 2026-10-12 and revised on 2026-10-26.
Deliverables and their order are in
`docs/product/implementation-roadmap.md`.

### Model

- A curve is a single aggregate: its index (fixed, and through it the value
  convention), editable name, description, and intervals, its owner, and a
  `revision`. Alternatives of one index are separate curves; screens group
  curves by index and origin, and no grouping is stored (decision 2026-10-11).
  Duplicating copies a curve's content into a new private curve, with no link
  back to its source.
- An offer follows the same single-aggregate model: its title type (fixed,
  and through it the methodology and taxation), editable name, optional
  issuer, remuneration and rate, maturity, and liquidity, its owner, and a
  `revision`. Variants from one issuer are separate offers; screens group
  offers by title type and origin, and no grouping is stored (decision
  2026-10-11). Editing an offer recalculates only the simulations that use
  it. Duplicating copies an offer's terms into a new private offer, with no
  link back to its source.
- Ownership is the Keycloak `sub` (`AuthenticatedUser.userId`); `null` means
  system-owned. Users read their own content plus system content and change
  only their own. System content is written by seed and import processes
  through application use cases, never through HTTP. No application roles are
  needed.
- A simulation references one offer, an optional curve, and
  holds its investment (principal and investment date). Editing any of those
  increments the simulation's own `revision`. A reference to an offer or
  curve that is not visible to the simulation's owner is treated as not
  found.
- `revision` starts at 1 and increments on every persisted change: once per
  save, however many changes the aggregate received in between, so a revision
  always names one persisted state. A `Revision` (`@investflow/shared-domain`)
  tracks it by comparing the current revision with the one last read or
  saved. An aggregate that needs one passes `Revision.initial()` or
  `Revision.restore(n)` to `AggregateRoot` and calls
  `revisionTracker.increment()` from its behavior methods; the others keep
  `Revision.fixed()`, always 1. `AggregateRoot` exposes `revision`, and
  `BaseRepository.save()`
  calls `markPersisted()` so the next change takes a new revision. Commands
  that change an offer, a curve, or a simulation carry the revision the
  client edited;
  a mismatch is a conflict, so concurrent edits (two tabs, a user and an
  import job) never overwrite each other silently. Repositories also update
  from the revision they read (`updateMany` on `id` and revision, 0 rows is
  the same conflict), so two concurrent transactions that both passed the
  check cannot both commit. Commands carry the actor (`string | null`, `null`
  for seed and import processes), and use cases report content the actor
  cannot see as not found and visible content they cannot change as
  `forbidden`.
- Every change to an offer or curve raises a past-tense domain
  event persisted through the transactional outbox (see
  `$investflow-eventing`). Events carry identifiers only. Consumers read
  current state, so events never carry revisions or values, and their size
  does not grow with the content.
- Events name what happened, never a generic "changed" (decided 2026-10-26):
  an offer raises `OfferTermsChanged` (maturity,
  remuneration), `OfferDetailsChanged` (name, issuer, liquidity), and
  `OfferDeleted`; a curve raises `CurveValuesChanged` (intervals),
  `CurveDetailsChanged` (name, description), and `CurveDeleted`. Only terms,
  values, and deletion affect a calculation. Liquidity joins the terms when
  early redemption is calculated.
- Offers and curves keep two counters (decided 2026-10-26):
  `revision`, raised by every change, guards concurrent edits (`409`);
  `termsRevision` on offers and `valuesRevision` on curves, raised only by
  changes that affect a calculation, are what results record. Renaming an
  offer or describing a curve therefore leaves its simulations up to date.

### Recalculation

Settled on 2026-10-12. `docs/architecture/event-flow.md` walks through the
flow with diagrams and every failure case.

A simulation has one current result. It stores what it was computed from: the
simulation revision, the offer's `termsRevision`, the curve's
`valuesRevision`, and the methodology version (see Model). The target is read from the current references, not
copied, so it can never drift from them.

The calculation state is a `SimulationCalculation` value object of the
`Simulation` aggregate, persisted in a 1:1 `simulation_calculation` table next
to `simulation_result`; nothing about it is stored on `simulation`.

| Status       | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `PENDING`    | The inputs changed; a calculation message is queued or being processed.              |
| `CALCULATED` | The stored result matches the inputs the calculation row applies to.                 |
| `INVALID`    | A business rule blocks the calculation; the reason code and metadata are stored.     |
| `FAILED`     | A technical failure exhausted the queue's retries and the message was dead-lettered. |

Every status also records `changedAt`, the simulation, offer, and curve
revisions it applies to, and the cause of the last queuing: its kind
(`CREATED`, `SIMULATION_EDITED`, `METHODOLOGY_CHANGED`, `RETRY_REQUESTED`)
and the actor (`null` for system processes). There are no offer or curve
causes: fan-out writes no calculation rows, so nothing would set them, and
premise events carry no actor either. The cause is set when the simulation
is queued and kept by the outcome, so after a premise change "Requer ação"
shows the reason with the simulation's own last cause (see "Recalculation
status on screen" in Deferred Work). Only the current
state is kept; a transition history is deferred work.

- **Requests validate synchronously, then calculate asynchronously.** Creating
  or editing a simulation checks visibility in the application and calls
  `SimulationCalculationService.validate()`: the `InvestmentScenario` rules
  (principal, period, minimum term, curve required, compatible, and not
  deleted) plus `InvestmentCalculator.check()` (supported remuneration,
  business days). Curve coverage is checked only by the calculation. The use
  case then persists the simulation as `PENDING` and raises the event of what
  happened (`SimulationCreated`, `SimulationEdited`, or, for "Tentar
  novamente", `SimulationCalculationRequested`) in the same transaction; the
  calculation consumer handles all of them. Nothing is
  calculated inside the request, so calculation cost is not bounded by
  request timeouts.
- **Calculation is a domain service.** `SimulationCalculationService`
  combines the simulation, its offer and curve, and `InvestmentCalculator`,
  and returns an outcome: `CALCULATED` with a `SimulationResult`, or
  `INVALID` with the reason. Technical failures are thrown, never recorded.
  `Simulation.recordCalculation()` accepts an outcome only for the
  simulation's current revision and owns the state transition.
- **Delivery is the queue's job.** The calculation consumer reads the
  `simulation-calculations` queue, a FIFO queue grouped by simulation, so one
  calculation per simulation is in flight at a time across every worker (see
  "Exclusivity per aggregate" under Messaging Transport). The visibility
  timeout keeps a message with one worker; a worker that dies leaves its
  message to reappear; a failing
  message is retried until `maxReceiveCount` and then dead-lettered; a
  consumer bound to the dead-letter queue sets `FAILED` while the simulation
  is still `PENDING`; `EventDispatcher` skips duplicate deliveries. There are
  no leases, claims, or `CALCULATING` status, and domain code knows nothing
  about queues.
- **Conditional writes.** Edits always overwrite the calculation row with
  `PENDING`, whatever is in flight; fan-out writes no calculation rows (see
  Fan-out). A worker calculates from current
  state, never from the event payload, and its save requires the row to still
  apply to the simulation revision it read; a `FAILED` write also requires the
  row to still be `PENDING`, so a late dead-letter delivery never replaces an
  outcome written meanwhile. Otherwise it discards the outcome and
  acknowledges the message: whatever made its inputs out of date queued its
  own message. The check does not cover the offer and curve revisions, and
  does not need to: a premise change queues a message in the same simulation
  group, which is delivered only after the running calculation finishes and
  then calculates from the latest premises. An outcome from an older premise
  can therefore land, shown "Desatualizado", but it is never the last write.
  Late, duplicate, or concurrent deliveries therefore cannot leave a stale
  state behind.
- **Fan-out** (decided and built 2026-10-26). A splitter in the
  simulations feature: `SimulationRecalculationConsumer` handles the facts
  that affect a calculation (`OfferTermsChanged`, `OfferDeleted`,
  `CurveValuesChanged`, `CurveDeleted`) directly, with no intermediate
  "recalculation requested" event, so offers and curves know nothing about
  simulations. Its use cases (`RecalculateOfferSimulationsUseCase` and
  `RecalculateCurveSimulationsUseCase`, one per premise) read the ids of the
  live simulations that use
  the premise from the repository (`SimulationRepository.idsUsingOffer()` and
  `idsUsingCurve()`, which return arrays) and records one
  `SimulationCalculationRequested` per id through `DomainEventRecorder`, all
  in the consumer's single unit of work: all or nothing, no paging, no
  aggregates loaded, no calculation rows written. The calculation worker
  then handles each request as usual. That transaction grows with the number
  of simulations, a deliberate simplification (see "Fan-out at scale" in
  Deferred Work). While a recalculation is on its way the screen shows the
  derived "Desatualizado", not "Calculando" (see "Recalculation status on
  screen" in Deferred Work). The fan-out queue has a dead-letter queue but
  no consumer bound to it: a dead-lettered fan-out wrote nothing, so its
  simulations stay honestly "Desatualizado" until saved again or until the
  message is redriven, which an alarm on the dead-letter queue should
  prompt.
- **Workers skip current work.** `CalculateSimulationUseCase` returns early,
  acknowledging the message, when the calculation already applies to the
  current inputs: a `CALCULATED` outcome recorded for the current simulation
  revision, offer `termsRevision`, curve `valuesRevision`, and methodology
  version; an `INVALID` one for the same revisions (it records no
  methodology); or an `INVALID` for a missing offer or curve that is still
  missing. `PENDING` and `FAILED` always
  calculate. Replays, duplicates, and overlapping fan-outs therefore cost one
  read.
- **Deletion requeues like a change.** Deleting an offer or curve fans out
  like a terms or values change; the worker finds the premise missing and
  records `INVALID` with `OFFER_NOT_FOUND` or `CURVE_NOT_FOUND`. Fan-out
  never writes `INVALID` itself: a simulation switched to another premise
  meanwhile is merely recalculated.
- **`INVALID` is scoped to its inputs.** Any change to them queues a new
  calculation.
- **Convergence without a sweep.** The outbox writes each event in the same
  transaction as its change, and SQS redelivers a message until it is handled
  or dead-lettered, so no change is left without a calculation. A methodology
  version change does not requeue anything yet (see Deferred Work).
- **Reads** return the last successful result together with the status, its
  cause, and the inputs it was computed from, so the screen can show
  "Calculando" or "Requer ação" over the previous values. The details screen
  polls the same endpoint about every 3 seconds whatever the status; the
  monthly balances refetch only when the result's `calculatedAt` changes. A
  change token with `ETag` and `304` can be added to the same endpoint if
  polling load ever shows up; real-time push is future work.
- A portfolio's status is derived from its simulations' statuses at read time.

## Messaging Transport

Decision dated 2026-10-11: integration events travel over Amazon EventBridge
and Amazon SQS, emulated locally by [Floci](https://github.com/floci-io/floci).
This replaces the earlier SNS topic per context.

- **Recording.** Events are recorded in the unit of work, the transaction
  every writing entry point runs in (`UnitOfWork.run()`: HTTP requests,
  consumers, the seed). Aggregates raise them with `apply()` and their
  repository records them on save; domain and application services record
  through the `DomainEventRecorder` port, which bulk work such as fan-out
  uses without loading aggregates. The unit of work writes the buffered
  events to `outbox_events` before commit, in chunks of 1,000 rows, so a
  change and its events commit together. Recording outside a unit of work
  throws.
- **Routing.** The outbox poller publishes every event to the custom bus
  `investflow` with `source` `investflow.<context>` and `detail-type` set to
  the event type; the `detail` is the serialized domain event. Each consumer
  owns one SQS queue fed by an EventBridge rule on `source` and `detail-type`.
  Publishers never know their consumers, and a new consumer is a new rule.
- **Exclusivity per aggregate.** Decided and built 2026-10-26: every consumer queue is
  an SQS FIFO queue (`<name>.fifo`, with a FIFO dead-letter queue) with
  content-based deduplication, and its rule target sets
  `SqsParameters.MessageGroupId` to the dynamic path `$.detail.aggregateId`.
  SQS never delivers a second message of a group while one is in flight,
  across every consumer instance, and a failing message holds its group until
  it succeeds or is dead-lettered. Correctness relies on that exclusivity, not
  on delivery order (EventBridge does not guarantee order, and the outbox
  publishes rows of one transaction in no particular order): consumers read
  current state, so the last message of a group always works from the latest
  state. This covers any state derived asynchronously per aggregate, so no
  consumer needs generation counters or a condition per input. Two rules come
  with it:
  - A listener may handle messages of different groups concurrently, but
    messages of one group strictly in the order received.
  - A handler must finish within the visibility timeout, or extend it while
    working; otherwise its message reappears beside it. `EventDispatcher`
    still runs the same event once, but a newer message of the group could
    then run alongside it.
- **Retries.** Every queue has a dead-letter queue. A message that is not
  deleted becomes visible again after the visibility timeout (30 seconds) and is
  dead-lettered after 5 receives. Retry policy is queue configuration, not code.
- **Publishing failures.** The outbox poller retries a failed event with
  exponential backoff per event (up to 5 minutes, indefinitely), so one bad
  event never blocks the rest, and pauses entirely when consecutive events
  fail, so an EventBridge outage costs 3 calls and 3 warnings per pause, with
  pauses growing to 60 seconds.
- **Payload limit.** The outbox owns a 200 KB payload limit, enforced when the
  event is recorded: events carry identifiers and changed fields, not documents.
  The limit is not derived from the transport; every broker adapter must
  accept payloads of that size (EventBridge accepts 256 KB per entry).
- **Hosts.** Consumers run in the API today and can become SQS-triggered
  Lambdas later. The future index-curve update Lambdas use EventBridge
  Scheduler and deliver data by publishing events or calling the API, so the
  database never needs to accept connections from outside the backend.
- **Hosting is not tied to AWS.** EventBridge and SQS are public HTTPS APIs. A
  backend on a VPS needs outbound HTTPS to AWS and credentials: a scoped IAM
  user key in the environment, or IAM Roles Anywhere.
- **Local emulation.** Floci needs no account or auth token, unlike LocalStack
  since its 2026.03 release. `infra/floci/init/provision.sh` runs on every
  container start (Floci keeps state in memory) and creates the bus and each
  consumer queue through `consumer_queue`. The SDK reaches Floci through
  `AWS_ENDPOINT_URL`; no code knows about the emulator. Known gap, verified on
  2026-10-26 with Floci 2.1.0: Floci enforces FIFO groups, but it does not
  evaluate dynamic target paths, so every message of a queue gets the literal
  group `$.detail.aggregateId`. Locally each queue is therefore a single
  group, processed strictly one message at a time: still correct, with no
  parallelism. Dynamic paths on rule targets are documented by AWS but not yet
  verified on real infrastructure; verify them in a homolog environment
  before relying on parallel consumers. If the path were not evaluated, AWS
  would behave like Floci: serial, never incorrect.
- **Ports.** `MessageBroker` (publishing) and `EventDispatcher` (deduplication
  per consumer, transaction, and `@OnEvent` dispatch) are transport-neutral.
  Only `EventBridgeMessageBroker`, `SqsEventListener`, and the provisioning
  script know the transport, so replacing it does not touch business code or
  consumers.

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

Aggregates and entities store state in a `private readonly props` object,
expose getters, and mutate only through behavior methods. Mark a props field
`readonly` only when it never changes after creation (an owner, a curve's
index, an offer's title type); behavior methods assign the other fields
directly rather than rebuilding the props object with a spread, which would
let any field be overwritten. Factories hand the constructor a fresh object,
never one the caller keeps. Value objects stay immutable. Use static factories
for creation and reconstitution.

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

### HTTP caching of the business calendar (deferred 2026-10-10)

`GET /investment-simulator/business-calendar?fromYear=&toYear=` returns the
weekday holidays of the requested years (about 2,000 dates for the 201 years
the page asks for).

- **Today:** the API keeps its last answer in memory, so the range every
  browser asks for is computed once per process until the year changes; the browser reads it once per session. The
  response sends no cache headers, so every new session repeats the request.
- **Why deferred:** one small request per session is cheap, and correctness
  came first.
- **Done means:**
  - Responses carry HTTP caching headers. They are bearer-authenticated, so
    use `Cache-Control: private` with a `max-age` ending at the next year
    change plus an `ETag`, so browsers revalidate cheaply.
  - The `ETag` includes a version of the calendar rules. A change to the
    holiday rules (a new national holiday, an ANBIMA calendar change) must
    invalidate cached responses instead of serving stale dates.
  - Tests cover the headers and invalidation on a rules version change.

### Durable audit of premise changes (deferred 2026-10-11)

The product records the revision and what changed for every change to an
offer or curve.

- **Today:** nothing records it. Domain events carry identifiers only (see
  Mutable Premises And Asynchronous Recalculation), so the audit cannot be
  derived from them, and the outbox is a delivery mechanism whose rows may be
  cleaned up.
- **Why deferred:** audit is a low-priority requirement. Aggregates already
  keep their revision, and use cases already know the actor and the change,
  so recording it later needs no aggregate change.
- **Done means:**
  - Each change is kept in a durable audit store (an `audit_entry` row written
    in the same transaction as the change), with the aggregate, revision,
    actor (user or system), instant, and changed fields' previous and new
    values.
  - Outbox cleanup cannot remove audit history.
  - Users can read the history of the offers and curves they can see.
  - Tests cover recording, ordering by revision, and visibility.

### Calculation status history (deferred 2026-10-12)

A simulation's calculation states over time (status, cause, actor, reason, and
instant), for support and for explaining past recalculations.

- **Today:** `simulation_calculation` keeps only the current state, with its
  cause, reason, and `changedAt` (see Recalculation). The PRD excludes
  calculation history and audit from the MVP.
- **Why deferred:** the current state with its cause answers what the screen
  needs. A history grows with every premise change across all users (a
  system curve edit writes at least two transitions per affected
  simulation), so it needs a retention rule and a product decision.
- **Done means:**
  - A product decision records what the history is for and who reads it.
  - Every write to `simulation_calculation`, including fan-out pages, also
    inserts the same described row into `simulation_calculation_transition`
    in the same transaction; the aggregate does not change.
  - A retention rule bounds its size, for example the last N transitions per
    simulation.
  - Tests cover recording from each write path and retention.

### Fan-out at scale (deferred 2026-10-26)

- **Today:** fan-out records every
  `SimulationCalculationRequested` for a premise in one unit of work, and the
  outbox poller publishes about 100 events per second. A system curve used
  by hundreds of thousands of simulations would need one very large
  transaction, could outlast the 30-second visibility timeout and be
  dead-lettered, and would take hours to publish.
- **Revisit with:** recording through the outbox in bounded chunks (a
  dispatcher mode whose handler opens its own units of work, ids streamed
  from the repository, a visibility heartbeat), or publishing directly in
  batches; batched `PutEvents` and polling until empty; and listeners that
  handle different message groups concurrently.
- **Done when** a premise reaching any number of simulations fans out in
  bounded transactions within the visibility timeout, and publishing keeps
  up.

### Recalculation status on screen (deferred 2026-10-26)

- **Today:** fan-out writes no calculation rows, so a
  simulation waiting for the recalculation of a premise change shows the
  derived "Desatualizado" until its new result lands, never "Calculando".
  For the same reason a fan-out calculation that exhausts its retries is
  not recorded `FAILED` (the dead-letter consumer writes `FAILED` only over
  `PENDING`): the simulation stays "Desatualizado", never "Falha técnica".
- **Revisit with:** a derived "Recalculando" status (the result's term or
  value revisions differ from the current ones, so a recalculation is on its
  way), with the cause from the input that differs and the actor from the
  premise's owner, in the workspace, the list (including its
  `calculationStatus` filter), and the comparison.
- **Done when** the screens say a simulation is being recalculated because
  its offer or curve changed, and say when that recalculation failed.

### Requeue after a methodology version change (deferred 2026-10-12)

- **Why deferred:** no methodology version has changed yet, and the trigger
  (automatic at startup or a deploy-time command) is a separate decision from
  premise fan-out.
- **What exists today:** results record their methodology version, and reads
  flag a result "Desatualizado" when its title type's current version
  differs. Nothing requeues it; saving the simulation again recalculates it.
- **Done when:** changing a title type's methodology version queues its
  simulations with cause `METHODOLOGY_CHANGED` through the fan-out page path,
  once per change.

### Single active outbox poller (deferred 2026-10-11)

`OutboxPollerService` runs in every process that imports `OutboxModule`.

- **Today:** one API instance runs, and an in-process flag keeps polls from
  overlapping. Rows are not claimed, so two instances would fetch and publish
  the same events. Consumers deduplicate, so nothing is processed twice, but
  every event would be published twice.
- **Why deferred:** nothing runs more than one instance yet.
- **Done means:**
  - Before a second API instance (or another host with `OutboxModule`) runs,
    only one poller publishes at a time, for example by taking a PostgreSQL
    advisory lock per poll, or rows are claimed with a lease.
  - Tests cover two pollers against one outbox publishing each event once.

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

### "Saldo hoje" balance (deferred 2026-10-17)

How much a simulation is worth today, so a user can follow an investment
through its term. It is a required feature, not an optional nicety.

- **Today:** the balance chart only marks today with the gross balance of
  the result's last daily balance on or before it, labelled as an estimate
  (roadmap D13). That marker is a read of the result calculated to maturity;
  it is not this feature.
- **Why deferred:** it needs product refinement and a domain concept and
  space of its own. The open questions are in the PRD's "Pendências de
  Produto": the reference date, gross or net (early redemption taxes depend
  on undefined liquidity and redemption rules), prefixed and manual-curve
  simulations and kept rates, simulations not yet invested or matured,
  whether a simulation can represent a realized investment, and a
  portfolio's current value.
- **Done means:**
  - The PRD records the refined rules as a dated decision, and the domain
    models "saldo hoje" as its own concept instead of a lookup in the
    maturity projection.
  - The screens that need it (the workspace, and whichever the decision
    names among the list, the comparison, and portfolios) show it, and the
    D13 marker is replaced or reconciled with it.
  - Tests cover the reference date, the edge states, and the gross/net rule.
