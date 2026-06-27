# Project Structure And Coding Patterns

InvestFlow uses a NestJS modular monolith with Nx-enforced DDD layers. The
project standardizes structure so bounded contexts can grow without losing
clear ownership or import boundaries.

## Layer And Context Layout

New bounded contexts live under `libs/<context>/` and are split into three Nx
projects:

- `domain`: aggregates, entities, value objects, domain services, events, and
  domain errors.
- `application`: use cases, query handlers, application services, listeners,
  and abstract-class ports.
- `infrastructure`: Nest modules, controllers, DTOs, Prisma repositories,
  query handlers, mappers, presenters, consumers, and logging adapters.

Contexts do not import one another directly. Cross-context communication uses
events. Shared building blocks stay under `libs/shared`.

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

## Results And Errors

Expected business and application failures use `Result<T, E extends AppError>`.
Use Result for meaningful failures from external input, use cases, domain and
application services, repository operations, and external integrations. Do not
force Result onto trivial pure methods.

Command-side repository ports return `Result` for aggregate lookup and
persistence. A missing aggregate is an error in that contract. Read/query models
may still use nullable values when absence is just part of the returned data.

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
