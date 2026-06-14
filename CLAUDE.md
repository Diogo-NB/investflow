# InvestFlow Repository Guidelines

## Architecture

InvestFlow is a NestJS 11 modular monolith managed with Nx and pnpm. The API in
`apps/api` is the deployable unit. New bounded contexts belong under `libs/`,
split into `domain`, `application`, and `infrastructure` projects. Reusable
cross-context code belongs in `libs/shared`.

The workspace preserves reusable DDD, Prisma transaction, transactional outbox,
SNS/SQS, and Keycloak authentication patterns. It intentionally contains no
implemented bounded context.

## Shared Imports

| Alias                               | Path                                      |
| ----------------------------------- | ----------------------------------------- |
| `@investflow/shared-domain`         | `libs/shared/domain/src/index.ts`         |
| `@investflow/shared-infrastructure` | `libs/shared/infrastructure/src/index.ts` |
| `@investflow/shared-types`          | `libs/shared/types/src/index.ts`          |

## Dependency Rules

- Domain projects depend only on domain or shared projects.
- Application projects depend on domain, application, or shared projects.
- Infrastructure projects may depend on all layers needed to implement ports.
- Shared projects never depend on bounded contexts.
- Separate bounded contexts communicate through events, not direct imports.

## Patterns

- Use static factories for aggregates and value objects.
- Keep domain behavior and invariant enforcement in the domain layer.
- Keep orchestration in application use cases and integrations in infrastructure.
- Modify one aggregate per transaction; coordinate other changes through events.
- Concrete repositories extend `BaseRepository` so aggregate writes and outbox
  events are persisted atomically.
- Query handlers may query Prisma directly and return read-oriented shapes.
- Domain-event `context` values are logical routing keys. Each bounded context
  owns its SNS environment variable and registers the resolved ARN through
  `OutboxTopicRegistry`.
- Keycloak roles are generic strings; define domain-specific roles only when the
  new domain requires them.

## Commands

Load NVM and run `nvm use` before Node, pnpm, or Nx commands. Prefer workspace
scripts and pnpm-prefixed Nx commands. Use `NX_DAEMON=false` where Unix sockets
are unavailable.

```bash
pnpm start:api
pnpm build:api
pnpm test
pnpm check
pnpm db:generate
pnpm db:migrate
pnpm db:up
pnpm kc:up
```

## Nx Guidelines

@AGENTS.md
