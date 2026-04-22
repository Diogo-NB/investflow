# InvestFlow — Claude Code Guidelines

## Stack

| Concern | Technology |
|---|---|
| Runtime | NestJS 11 + TypeScript |
| Database | PostgreSQL (Prisma 7 + @prisma/adapter-pg) |
| Message Broker | AWS SNS + SQS |
| IAM | Keycloak (OIDC + JWT) |
| Monorepo | Nx 22 |

## Architecture

Modular Monolith + Event-Driven Architecture + DDD.
- Bounded contexts live in `libs/` as Nx libraries
- `apps/api` is the single deployable unit — imports modules from libs

## Import Aliases

| Alias | Path |
|---|---|
| `@investflow/investments-domain` | `libs/investments/domain/src/index.ts` |
| `@investflow/investments-application` | `libs/investments/application/src/index.ts` |
| `@investflow/investments-infrastructure` | `libs/investments/infrastructure/src/index.ts` |
| `@investflow/portfolio-domain` | `libs/portfolio/domain/src/index.ts` |
| `@investflow/portfolio-application` | `libs/portfolio/application/src/index.ts` |
| `@investflow/portfolio-infrastructure` | `libs/portfolio/infrastructure/src/index.ts` |
| `@investflow/shared-domain` | `libs/shared/domain/src/index.ts` |
| `@investflow/shared-infrastructure` | `libs/shared/infrastructure/src/index.ts` |
| `@investflow/shared-types` | `libs/shared/types/src/index.ts` |

## Lib Dependency Rules (enforced by Nx boundaries)

| Lib | May depend on | Must NOT depend on |
|---|---|---|
| `investments/domain` | `shared/domain` | any infra or application lib |
| `investments/application` | `investments/domain`, `shared/domain`, `shared/types` | `portfolio/*`, infra libs |
| `investments/infrastructure` | `investments/application`, `shared/infrastructure` | `portfolio/*` |
| `portfolio/*` | `shared/*` | `investments/*` — use events instead |
| `shared/*` | — | `investments/*`, `portfolio/*` |

## Non-Negotiable Rules

**Multi-tenancy:** Every DB query MUST be scoped — `organizationId` for ORG_USER operations, `userId` for INVESTOR operations. No unscoped queries allowed at any layer.

## Patterns

- **Aggregates:** use static factory methods (`Entity.create(props)`) — no `new` calls outside the aggregate file
- **Single aggregate per transaction** — never modify two aggregates in one transaction. Side effects on other aggregates use domain events via outbox
- **Domain Events:** raised inside aggregate methods via `this.apply()`, accessible via `getDomainEvents()`. Use cases never handle events directly — just call `repo.save()`
- **BaseRepository pattern:** every repository extends `BaseRepository<T extends AggregateRoot>` from `shared/infrastructure`. `BaseRepository.save()` atomically persists the aggregate state AND writes its domain events to `outbox_events`. Concrete repositories only implement `persistAggregate()`. `getDomainEvents()` and `clearDomainEvents()` are called exclusively by `BaseRepository`
- **Transactional Outbox:** `BaseRepository.save()` writes events to `outbox_events` in the same Prisma transaction → `OutboxPollerService` (@Cron 5s) reads unpublished rows → publishes to SNS topic (determined by `context` field) → marks `published_at`. SNS fans out to subscribed SQS queues. Consumers are idempotent via `processed_events` table
- **SNS + SQS topology:** one SNS topic per bounded context (`investflow-investments`), one SQS queue + DLQ per consumer (`investflow-portfolio-events`, `investflow-portfolio-events-dlq`). Publisher knows only the SNS topic — zero coupling to consumers. `SqsConsumerBase` unwraps the SNS envelope before processing
- **Derived Volume:** `InvestmentProduct` does NOT store `allocatedVolume`. Volume is derived via `SUM(orders.amount) WHERE status IN ('PENDING','ANALYZING','APPROVED')`. This avoids cross-aggregate transactions on Order creation. Terminal order states automatically "release" volume
- **Calculation Strategy:** `InvestmentCalculationService` uses Strategy pattern — one class per indexer type (SELIC, CDI, IPCA)
- **CQRS (lightweight):** Use cases are the write side — their input is a plain command DTO. Query handlers are the read side — they query Prisma directly, never loading domain aggregates. No mediator bus — handlers are injected and called directly. Command DTOs live in `application/use-cases/<feature>/`. Query handlers (and their query DTOs) live in `infrastructure/query-handlers/`. No `*ReadModel` interfaces unless explicitly requested.
- **Ports & Adapters:** application layer defines interfaces (ports); infrastructure implements them

## Build & Dev Commands

Always prefer the workspace scripts over invoking `nx` directly.

```bash
pnpm start:api      # Start the API (nx serve api)
pnpm build:api      # Build the API
pnpm test           # Run all tests (nx run-many -t test)
pnpm db:generate    # Regenerate Prisma client
pnpm db:up          # Start Postgres via docker compose
pnpm kc:up          # Start Keycloak via docker compose
```

To test a single project:
```bash
pnpm nx run <project>:test --testPathPatterns=<file>
```

## Nx Guidelines

@AGENTS.md
