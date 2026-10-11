# InvestFlow

NestJS and React Nx workspace for an investment-related, event-driven DDD
application. The API and client-rendered web application are independent
deployable hosts. The investment simulator is the first active backend bounded
context. The authenticated web app includes a welcome page and offer management
in a lazy-loaded context-owned browser library.

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

`pnpm start` starts PostgreSQL, Keycloak, and Floci, then serves the API and web
applications in parallel. Use `pnpm start:api` or `pnpm start:web` when only
one application is needed, and `pnpm db:down` to stop the infrastructure
containers.

The web application runs at `http://localhost:4200` and proxies relative
`/api` requests to the API at `http://localhost:3000` during development.
Production hosting must route `/api` to the NestJS deployment and serve the SPA
entrypoint for browser routes, including `/ofertas` and its detail/editor routes.

Opening the web application redirects to the local Keycloak login. For local
development only, use username `investflow-dev` and initial password
`investflow-dev`; complete Keycloak's required profile fields and replace that
password on first login. The imported realm and these credentials must never be used in
production. Successful login opens the Portuguese welcome page with your identity
and a logout action. Authentication initialization failures show a retry action.
The existing realm supports these screens; no database reset is needed.

The web app uses two committed, typed environment files: one for local
development and one for production. Update the production file with the
deployed Keycloak public URL before releasing, then build with the production
configuration:

```sh
pnpm nx build web --configuration=production
```

The production URL is currently a placeholder. Set the real URL before deploying.
Configuration is compiled into the browser bundle and must not contain secrets.
The SPA uses Authorization Code Flow with PKCE S256, keeps tokens in memory, and
sends bearer tokens only to `/api` and `/api/...` relative requests. Login returns
to the requested route and query string, so direct offer links and reloads keep
their context. Active
sessions refresh on token expiry. At expiry, 30 minutes of inactivity triggers
logout; this is not a separate wall-clock timer. Logout returns to the app origin
and immediate-login behavior applies again. Production Keycloak provisioning is
separate and must configure its own users plus the SPA URLs. `WEB_APP_ORIGIN`
parameterizes the redirect, web-origin, and post-logout URLs in the local realm
import.

The API exposes a public database health check at
`http://localhost:3000/api/health-check`. All other routes are authenticated by
the shared Keycloak JWT guard unless marked with `@Public()`.

## Infrastructure

| Script             | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `pnpm db:up`       | Start PostgreSQL, Keycloak, and Floci with existing state            |
| `pnpm db:down`     | Stop and remove the containers while preserving state                |
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
Prisma generates UUIDs when records are created. Reruns match offers by
issuer name/title/redemption/remuneration, and curves by name/index.
In one transaction, the seed restores rates, maturity dates, descriptions, and
soft-deleted offers and curves, replacing intervals only for matching curves.
Those matching fields identify the local fixtures; changing them causes a new
fixture to be created on the next run. Other records are preserved.
Keycloak users remain managed by the realm
import. The runner lives under `tools/database`, with fixtures grouped by context.

Domain events reach consumers through EventBridge and SQS, emulated locally by
Floci on port 4566. Events are published to the `investflow` bus with their
`context` as the source; each consumer has its own queue and dead-letter queue,
provisioned by `infra/floci/init/provision.sh` when the container starts. See
"Messaging Transport" in `docs/architecture/project-structure.md`.

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

## Frontend

The web app is a React 19 + Vite 8 SPA (`apps/web`) using React Router (Data
mode), Tailwind v4, `keycloak-js`, and Vitest, with locally hosted IBM Plex
Sans and its included Open Font License. TanStack Query, React Hook Form with
Zod, and Base UI arrive with the offer catalog rebuild.

- [Frontend architecture, stack versions, and status](docs/architecture/frontend-patterns.md)
- [Visual rules and tokens](DESIGN.md)
- [Repository React skill](.agents/skills/investflow-react/SKILL.md)

```sh
pnpm nx run web:lint
pnpm test:web
pnpm nx build web --configuration=development
pnpm build:web
```

Unit tests exercise Keycloak startup, the session refresh and inactivity policy,
identity, logout, and routing without asserting rendered markup. Verify login,
logout, startup failure and retry, keyboard focus, and responsive layouts in a
browser. No permanent browser E2E project is included.

### Offer management

The browser offer catalog is being rebuilt as a React library, so the web app
currently shows only the welcome page. The offer API is unchanged; see the
[offer HTTP contract](libs/investment-simulator/infrastructure/README.md). The
screens to rebuild are specified in
[Offer CRUD behavior](docs/architecture/frontend-patterns.md#offer-crud-behavior).
