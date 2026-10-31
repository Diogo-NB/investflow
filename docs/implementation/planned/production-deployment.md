# Production Deployment

> **Status: in progress.** Decisions settled 2026-10-30; delivery steps 1
> (fixes) and 2 (images and compose) built 2026-10-31. Delete this
> file once it ships, moving the decisions to a deployment architecture doc
> and the setup steps to a runbook beside `infra/dokploy/compose.yaml`, with the
> outcome in [Current State](../current-state.md).

InvestFlow runs on the shared personal VPS described in
`personal-platform/docs/vps-platform.md`: Dokploy, a shared PostgreSQL 17
(database and role `investflow`, internal host only, no external port), and
Keycloak at `https://auth.diogo-nb.com.br` with the production `investflow`
realm. The site is `https://investflow.diogo-nb.com.br`. EventBridge and SQS
stay on AWS in `sa-east-1`; the API reaches them over HTTPS with a scoped IAM
user (see "Hosting is not tied to AWS" in
[Messaging Transport](../../architecture/messaging.md)).

## Decisions

- **Images.** Two public images in GHCR (GitHub Container Registry):
  `ghcr.io/diogo-nb/investflow-api` and `ghcr.io/diogo-nb/investflow-web`.
  The repository is public (since 2026-10-31; its history holds no secrets),
  so the images reveal nothing the code does not, and the VPS
  pulls them without registry credentials. GHCR creates packages private, so
  each is made public once after its first push. CI builds once ("build once, deploy
  many"): it runs `pnpm check` and `pnpm nx run api:prune`, and the
  Dockerfiles only copy `dist/` and install production dependencies, so the
  shipped build is the tested one. A local `docker build` needs the prune
  first.
- **Migrations.** A one-shot `investflow-migrate` compose service runs
  `prisma migrate deploy` with the API image; `investflow-api` waits for it
  with `condition: service_completed_successfully`, so a failed migration
  stops the deploy instead of looping the API. Migrations cannot run in CI:
  PostgreSQL is reachable only inside `dokploy-network`, and reaching it from
  a runner would need a public port or an SSH key to the host. The API image
  therefore contains the Prisma CLI and `dotenv` (imported by
  `prisma.config.ts`), declared in `apps/api/package.json` so the pruned
  lockfile pins them; the CLI also generates the Prisma client at image build
  time. Its dependencies (Prisma Studio, PGlite, TypeScript, React) add about
  200 MB to the image (865 MB in all), a cost on disk and on the first pull
  only.
- **Version selection.** Dokploy reads `infra/dokploy/compose.yaml` from `main`, so
  the file names a moving tag, `:production`, with `pull_policy: always`. A
  release pushes the immutable `:vX.Y.Z` images, then points `:production` at
  them once both exist. Rollback points `:production` at an older version and
  deploys again; migrations only move forward, so rolling back past a
  migration requires the old code to work with the newer schema. Setting an
  `IMAGE_TAG` from CI was rejected: Dokploy stores the environment as one
  string with the secrets, so CI would read and rewrite them. Tradeoff:
  Dokploy shows `:production`, not the version; the last successful release
  run says which one is deployed. The release requires the tag to be on
  `main`, which narrows (not closes) the window where a newer compose file
  deploys with older images.
- **Deploy trigger.** CI calls the Dokploy API (`POST /api/compose.deploy`,
  `X-API-Key`) once and does not wait for the result; a failed deploy shows in
  Dokploy's logs. Autodeploy stays off. The deploy webhook is not an option:
  it answers 400 while autodeploy is off, and even with it on it takes the
  branch from GitHub push headers, so a plain call from CI is rejected. The
  key belongs to a Dokploy member limited to the `investflow` project, never
  an owner key, which controls every service on the host.
- **AWS infrastructure.** AWS CDK in TypeScript, in a new Nx project
  `infra-aws` under `infra/aws/`, deployed by hand from a workstation; CI has
  no AWS credentials. `infra/floci/init/provision.sh` stays the local
  provisioning, and a test keeps the two queue definitions in step.
- **EventBridge delivery failures.** Each rule target gets a standard SQS
  dead-letter queue, so an event EventBridge cannot deliver is kept instead
  of dropped (its simulation would otherwise stay `PENDING`). Alarms on it
  are later work.
- **Database pool.** `PrismaService` gives its `pg` pool an explicit
  `max: 10`, a constant: the shared instance's `max_connections` (100) is
  split across projects. A `connection_limit` URL parameter has no effect
  with the `pg` driver adapter.
- **Keycloak.** The production web build points at
  `https://auth.diogo-nb.com.br`. `KEYCLOAK_CLIENT_SECRET` leaves
  `.env.example`: no code reads it. The local-testing skill's token command
  writes the local realm's dev secret inline; the local realm stays as it is.

## Scope

**Fixes.**

- `apps/web/src/environments/environment.production.ts`: the Keycloak URL.
- `.env.example`: drop `KEYCLOAK_CLIENT_SECRET`; the token command in
  `investflow-local-testing` uses the dev secret inline.
- `prisma.service.ts`: `max` on the pool.
- `apps/api/src/main.ts`: drop the "not a production server" comment.

**Images.**

- `apps/api/Dockerfile` on `node:22.22.1-bookworm-slim` (matching
  `.nvmrc`): installs the pruned `package.json`, `pnpm-lock.yaml`, and
  `workspace_modules` with `--prod` and the pnpm version of the root
  `package.json`, generates the client, copies
  `libs/shared/infrastructure/prisma/` and `dist/apps/api`, and runs
  `node main.js` as the `node` user. It installs `openssl`, which Prisma
  probes to pick its schema engine.
- `apps/api/package.json`, the source of the pruned `package.json`, also
  declares `prisma`, `dotenv`, and the modules the bundle requires but did
  not list (`tslib`, `uuid`), and allows the install scripts of `prisma` and
  `@prisma/engines` (pnpm 10 skips others), which download the schema
  engine.
- `apps/web/Dockerfile` on pinned `nginxinc/nginx-unprivileged` (port 8080),
  with an `nginx.conf` that falls back to `index.html`, caches `/assets/` as
  immutable for a year, `/fonts/` (not fingerprinted) for a week, and
  serves `index.html` with `no-cache`, all gzipped.
- A `.dockerignore` allowlist: `dist/` and the Prisma folder.

**`infra/dokploy/compose.yaml`.** Services `investflow-migrate`, `investflow-api`,
and `investflow-web`, all on the external `dokploy-network` (names are
prefixed because the network is shared by every project), each with
json-file logging capped at 10 MB × 3:

| Service              | Memory limit | Heap   | Notes                                                                                                                                            |
| -------------------- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `investflow-migrate` | 256 MB       | 128 MB | Node plus Prisma's schema engine; 117 MiB peak applying every migration                                                                          |
| `investflow-api`     | 384 MB       | 256 MB | Platform memory budget, 153 MiB after a calculation; health check on `/api/health-check`; `stop_grace_period: 30s` covers the 20 s SQS long poll |
| `investflow-web`     | 32 MB        | —      | Platform memory budget, 10 MiB; starts after the API is healthy                                                                                  |

Configuration that is not secret is written in the file: `KEYCLOAK_URL`,
`KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `AWS_REGION=sa-east-1`,
`EVENT_BUS_NAME`, and the queue URLs built from `${AWS_ACCOUNT_ID}`. Dokploy
holds only `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
`AWS_ACCOUNT_ID`. Traefik routes `/` to the web container and `/api` to the
API without stripping the prefix (Nest serves under `/api`).

**Workflows.** Actions pinned to commit SHAs, `permissions: {}` by default.

- `release.yml`, on `v*` tags, in one non-cancelling `production-deploy`
  concurrency group: rejects tags other than `vX.Y.Z` and tags not on
  `main`; runs `pnpm check` and the prune; builds and pushes both images
  as `:vX.Y.Z`; then, in the `production` GitHub environment, points
  `:production` at them and calls `compose.deploy`.
- `rollback.yml`, manual with a version input: points `:production` at that
  version and calls `compose.deploy`.

**`infra/aws/`** (`infra-aws`, tags `scope:infra` and `platform:server`,
importing no library; `aws-cdk-lib`, `constructs`, and `aws-cdk` as dev
dependencies; targets `synth`, `diff`, `deploy`, `test`, `typecheck`, `lint`).
`InvestflowMessagingStack` in `sa-east-1`, termination protection on:

- The `investflow` event bus.
- Per consumer queue, mirroring `consumer_queue`: a FIFO dead-letter queue
  (content-based deduplication, 14-day retention), the FIFO queue (content-
  based deduplication, 30 s visibility timeout, dead-lettered after 5
  receives, SSE-SQS), and a rule with the event pattern targeting the queue
  with `MessageGroupId` `$.detail.aggregateId` and the EventBridge
  dead-letter queue. Queues: `simulation-calculations` and
  `simulation-recalculations`, with the patterns in `provision.sh`.
- The IAM user `investflow-api`: `events:PutEvents` on the bus;
  `sqs:ReceiveMessage` and `sqs:DeleteMessage` on the three consumed queues
  (`simulation-calculations`, its dead-letter queue, and
  `simulation-recalculations`). Its access key is created by hand
  (`aws iam create-access-key`) and stored only in Dokploy, so the secret
  never enters CloudFormation.
- Queue URLs as outputs.
- A spec asserting those attributes, and that the queue names and patterns
  match the `consumer_queue` lines in `provision.sh`.

**Manual setup.**

- GitHub: after the first release, make both packages public; the
  `production` environment with the Dokploy URL, compose ID, and API key.
- AWS: deploy the stack; create the access key.
- Dokploy: a compose service in the `investflow` project reading
  `infra/dokploy/compose.yaml` from `main`, autodeploy off; its environment; the two
  domain routes; a member limited to the project and its API key, checked to
  be unable to deploy other services.
- personal-platform: point the InvestFlow "Deployment" line in
  `docs/vps-platform.md` at the deployment architecture doc instead of this
  file.

## Delivery

1. **Fixes.** The four fixes above.
2. **Images and compose.** Dockerfiles, `nginx.conf`, `.dockerignore`,
   `infra/dokploy/compose.yaml`.
3. **AWS stack.** Deployed and the access key created before the first
   release: the API fails to start without its queue URLs.
4. **Workflows.** Then the manual setup and the first tag, `v0.1.0`.

## Verification

- Each step: `pnpm check`; `pnpm nx run api:prune` when dependencies change.
- Images, on the local stack: build both; run the migration and the API
  against local PostgreSQL, Keycloak, and Floci; check the health check, an
  authenticated call, and a simulation reaching `CALCULATED` with its outbox
  and `processed_events` rows; measure peak memory with `docker stats`; check
  that the web image answers unknown routes with `index.html`.
- AWS stack: `cdk synth` and the spec. After deploying and before the API
  first starts, put one event on the bus and receive it with
  `--message-system-attribute-names MessageGroupId`, confirming that real
  AWS evaluates the dynamic group path left unverified in
  [Messaging Transport](../../architecture/messaging.md); then delete it.
- First release: the API container fetches JWKS from
  `auth.diogo-nb.com.br` (the VPS calling its own public address); a real
  user logs in at the site and a simulation is calculated.

## Docs at close-out

- A deployment architecture doc with these decisions, and a runbook beside
  `infra/dokploy/compose.yaml` (setup, key rotation, rollback, migration
  compatibility), both listed in `docs/README.md`.
- [Messaging Transport](../../architecture/messaging.md): production
  provisioning and the verified group path.
- `investflow-eventing`: a new queue also needs its definition in the stack;
  `infra/aws/**` joins its route in `AGENTS.md` and the hook's `ROUTES`.
- `AGENTS.md` commands and [Current State](../current-state.md).

## Done when

A `vX.Y.Z` tag on `main` deploys the site, migrations run before the API
starts, a simulation created in production is calculated through AWS, and
rollback restores a previous version.

## Later

- A CI workflow that runs `pnpm check` on pull requests.
- Alarms on the dead-letter queues.
- IAM Roles Anywhere instead of a long-lived access key.
- A `staging` environment.
- A Content Security Policy header in `nginx.conf`.
