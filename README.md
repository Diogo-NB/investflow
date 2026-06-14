# InvestFlow

NestJS + Nx modular monolith starter for an investment-related, event-driven
DDD application. The repository currently contains shared architectural
building blocks only; bounded contexts are added as the domain is defined.

## Prerequisites

- Node.js 22.x LTS
- pnpm 10
- Docker

## First-Time Setup

```sh
cp .env.example .env
nvm install
nvm use
corepack enable
pnpm install
pnpm db:up
pnpm kc:up
pnpm db:generate
```

The repository pins Node through `.nvmrc` and pnpm through `packageManager`.
Load NVM before running Node, pnpm, or Nx commands.

## Development

```sh
pnpm start:api
pnpm check
```

The API exposes a public database health check at
`http://localhost:3000/api/health-check`. All other routes are authenticated by
the shared Keycloak JWT guard unless marked with `@Public()`.

## Infrastructure

| Script             | What it does                                 |
| ------------------ | -------------------------------------------- |
| `pnpm db:up`       | Start PostgreSQL                             |
| `pnpm db:down`     | Stop and remove containers                   |
| `pnpm db:reset`    | Wipe volumes and restart PostgreSQL          |
| `pnpm db:logs`     | Tail PostgreSQL logs                         |
| `pnpm kc:up`       | Start Keycloak and import the local realm    |
| `pnpm kc:down`     | Stop Keycloak                                |
| `pnpm kc:logs`     | Tail Keycloak logs                           |
| `pnpm db:generate` | Regenerate the Prisma client                 |
| `pnpm db:migrate`  | Create/apply migrations after schema changes |

Domain events use their `context` field to select an SNS topic. Each bounded
context registers its own topic during module initialization through the shared
`OutboxTopicRegistry`.
