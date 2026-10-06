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

| Script             | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `pnpm db:up`       | Start PostgreSQL and Keycloak with existing state                    |
| `pnpm db:down`     | Stop and remove both containers while preserving state               |
| `pnpm db:setup`    | Recreate databases, import realm, migrate, generate client, and seed |
| `pnpm start`       | Start local infrastructure, API, and web applications                |
| `pnpm db:generate` | Regenerate the Prisma client                                         |
| `pnpm db:migrate`  | Create/apply migrations after schema changes                         |
| `pnpm db:seed`     | Generate the Prisma client and restore local sample data             |

`pnpm db:setup` is destructive: it deletes all local PostgreSQL and Keycloak
state before rebuilding the development environment. It applies committed
migrations with `migrate deploy`; use `pnpm db:migrate` to author migrations.

### Local Seed Data

`pnpm db:setup` seeds fictional issuer **Banco Local** with four offers, all
maturing on **2028-12-31**:

| Title | Redemption  | Remuneration       |
| ----- | ----------- | ------------------ |
| CDB   | Daily       | 110% of CDI        |
| CDB   | Daily       | 100% of SELIC      |
| LCI   | At maturity | Fixed 12% annually |
| LCA   | At maturity | IPCA + 6% annually |

The **CDI Local**, **SELIC Local**, and **IPCA Local** curves each cover
**2026-01-01 through 2028-12-31**, inclusive, with one constant interval.
CDI and effective SELIC use **13.65% annually**, on a 252-day basis, as reported
by [ANBIMA on 2026-10-05](https://www.anbima.com.br/informacoes/indicadores/).
IPCA uses the latest published trailing annual rate available on that date:
**4.22% for August 2026**, published on 2026-09-11
([Ministry of Finance release](https://www.gov.br/fazenda/pt-br/central-de-conteudo/publicacoes/conjuntura-economica/inflacao/defeso-eleitoral-2026/informativo-ipca-ago2026.html/view)).
Its constant monthly equivalent is `(1.0422)^(1/12) - 1`, stored as
`0.003450427692416233215455407623` and repeated for every month in the range.
These are hardcoded local simulation fixtures; seeding makes no market-data
requests and does not update rates based on the current date.

Run `pnpm db:seed` to restore sample data without resetting the databases.
Prisma generates UUIDs when records are created. Reruns match the issuer by
name, offers by issuer/title/redemption/remuneration, and curves by name/index.
In one transaction, the seed restores rates, maturity dates, descriptions, and
soft-deleted offers and curves, replacing intervals only for matching curves.
Those matching fields identify the local fixtures; changing them causes a new
fixture to be created on the next run. Other records are preserved.
Keycloak users remain managed by the realm
import. The runner lives under `tools/database`, with fixtures grouped by context.

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
