# InvestFlow

NestJS and Angular Nx workspace for an investment-related, event-driven DDD
application. The API and client-rendered web application are independent
deployable hosts. The investment simulator is the first active bounded context.

## Product Documentation

- [Investment simulator PRD](docs/product/investment-simulator-prd.md)
- [Index value curves: business context and decisions](docs/product/index-value-curves.md)

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
pnpm db:setup
pnpm db:generate
```

The repository pins Node through `.nvmrc` and pnpm through `packageManager`.
Load NVM before running Node, pnpm, or Nx commands.

## Development

```sh
pnpm start
pnpm check
```

`pnpm start` starts PostgreSQL and Keycloak, then serves the API and web
applications in parallel. Use `pnpm start:api` or `pnpm start:web` when only
one application is needed, and `pnpm db:down` to stop the infrastructure
containers.

The web application runs at `http://localhost:4200` and proxies relative
`/api` requests to the API at `http://localhost:3000` during development.
Production hosting must route `/api` to the NestJS deployment.

Opening the web application redirects to the local Keycloak login. For local
development only, use username `investflow-dev` and initial password
`investflow-dev`; Keycloak requires you to replace that password on first
login. The imported realm and these credentials must never be used in
production. If the realm already existed before this client was added, run
`pnpm db:setup` to recreate the local databases and import it again.

Angular uses two committed, typed environment files: `environment.ts` for
local development and `environment.production.ts` for production. Update the
production file with the deployed Keycloak public URL before releasing, then
build with Angular's production configuration:

```sh
pnpm nx build web --configuration=production
```

The production configuration is compiled into the browser bundle and must not
contain secrets. The SPA
uses Authorization Code Flow with PKCE, persists no token, and sends bearer
tokens only to relative `/api` requests. Production Keycloak provisioning is
separate and must configure its own users plus the SPA URLs. `WEB_APP_ORIGIN`
parameterizes the redirect, web-origin, and post-logout URLs in the local realm
import.

The API exposes a public database health check at
`http://localhost:3000/api/health-check`. All other routes are authenticated by
the shared Keycloak JWT guard unless marked with `@Public()`.

## Infrastructure

| Script             | What it does                                           |
| ------------------ | ------------------------------------------------------ |
| `pnpm db:up`       | Start PostgreSQL and Keycloak with existing state      |
| `pnpm db:down`     | Stop and remove both containers while preserving state |
| `pnpm db:setup`    | Recreate both databases, migrate, and import the realm |
| `pnpm start`       | Start local infrastructure, API, and web applications  |
| `pnpm db:generate` | Regenerate the Prisma client                           |
| `pnpm db:migrate`  | Create/apply migrations after schema changes           |

`pnpm db:setup` is destructive: it deletes all local PostgreSQL and Keycloak
state before rebuilding the development environment. Application seed data can
be added to this command when a development dataset is defined.

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
