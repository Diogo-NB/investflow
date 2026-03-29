# InvestFlow — Claude Code Guidelines

## Stack

| Concern | Technology |
|---|---|
| Runtime | NestJS 11 + TypeScript |
| Database | PostgreSQL (TypeORM or raw queries) |
| Message Broker | AWS SQS |
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
- **Domain Events:** raised inside aggregate methods, collected by `getUncommittedEvents()`, dispatched after persistence — transport mechanism TBD
- **Calculation Strategy:** `InvestmentCalculationService` uses Strategy pattern — one class per indexer type (SELIC, CDI, IPCA)
- **Ports & Adapters:** application layer defines interfaces (ports); infrastructure implements them

## Nx Guidelines

@AGENTS.md
