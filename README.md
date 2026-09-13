# InvestFlow

NestJS and Angular Nx workspace for an investment-related, event-driven DDD
application. The API and client-rendered web application are independent
deployable hosts. The investment simulator is the first active bounded context.

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
pnpm start:web
pnpm check
```

The web application runs at `http://localhost:4200` and proxies relative
`/api` requests to the API at `http://localhost:3000` during development.
Production hosting must route `/api` to the NestJS deployment.

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

## Architecture Conventions

Deployable processes live under `apps/`, while each business capability lives
under `libs/<context>/` and is split into domain, application, and
infrastructure projects. `apps/api` currently imports every active context and
deploys them together as a modular monolith. Future service or Lambda apps can
compose one context and only the adapters needed by that runtime without moving
the business code.

Only domain projects must remain framework-free. Application and
infrastructure projects may use NestJS, but process bootstrap, lifecycle, and
EC2/Lambda-specific setup belong to the app that hosts them.

Project structure, runtime composition, file suffixes, dependency injection,
Result/error handling, and class design conventions are documented in
[`docs/architecture/project-structure.md`](docs/architecture/project-structure.md).
