# InvestFlow

NestJS + Nx monorepo. Modular monolith, event-driven, DDD.

## Prerequisites

- Node.js 22+
- pnpm
- Docker

## First-time setup

```sh
cp .env.example .env
pnpm install
pnpm db:up       # starts Postgres (creates investflow + keycloak DBs)
pnpm kc:up       # starts Keycloak (imports investflow realm automatically)
pnpm nx run api:migrate   # run Prisma migrations
```

## Running the API

```sh
pnpm nx serve api
```

## Infrastructure scripts

| Script | What it does |
|---|---|
| `pnpm db:up` | Start Postgres |
| `pnpm db:down` | Stop and remove containers |
| `pnpm db:reset` | Wipe volumes and restart Postgres |
| `pnpm db:logs` | Tail Postgres logs |
| `pnpm kc:up` | Start Keycloak |
| `pnpm kc:down` | Stop Keycloak |
| `pnpm kc:logs` | Tail Keycloak logs |

## Local service URLs

| Service | URL | Credentials |
|---|---|---|
| API | http://localhost:3000 | — |
| Keycloak admin | http://localhost:8080 | admin / admin |
| Postgres | localhost:5432 | postgres / postgres |

## Verify Keycloak is working

```sh
# Realm discovery
curl http://localhost:8080/realms/investflow/.well-known/openid-configuration

# Client credentials token
curl -s -X POST http://localhost:8080/realms/investflow/protocol/openid-connect/token \
  -d "client_id=investflow-api&client_secret=dev-investflow-api-secret&grant_type=client_credentials"
```