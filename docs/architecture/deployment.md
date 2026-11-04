# Production Deployment

Decisions dated 2026-10-30 and 2026-10-31; first release `v0.1.0` on
2026-10-31. Procedures are in the [runbook](../../infra/dokploy/README.md).

InvestFlow runs at `https://investflow.diogo-nb.com.br` on the shared
personal VPS described in `personal-platform/docs/vps-platform.md`: Dokploy
with Traefik, a shared PostgreSQL 17 (database and owner role `investflow`,
reachable only inside `dokploy-network`), and Keycloak at
`https://auth.diogo-nb.com.br` with the production `investflow` realm.
EventBridge and SQS stay on AWS in `sa-east-1`, reached over HTTPS (see
"Hosting is not tied to AWS" in [Messaging Transport](./messaging.md)).

```
PR ─▶ CI ─▶ main ─▶ release PR ─▶ release vX.Y.Z ─▶ GHCR :vX.Y.Z ─▶ :production ─▶ Dokploy API
                    (Release Please)  (pnpm check,                                   │
                                       prune, images)                                ▼
                              VPS: investflow-migrate ─▶ investflow-api ─▶ investflow-web
                                        │                   │      │
                                   PostgreSQL           EventBridge, SQS (AWS)
```

## Stack

- **One Dokploy compose service** reads
  [`infra/dokploy/compose.yaml`](../../infra/dokploy/compose.yaml) from
  `main`, with four services on the shared `dokploy-network`. Their names
  carry the project because every project on the host shares that network.
  Traefik routes `/` to `investflow-web` and `/api` to `investflow-api`
  without stripping the prefix, since Nest serves under `/api`. The backend
  and the web app are released together from one tag, so one service keeps
  them on the same version and enforces their order; separate services would
  allow deploying one side alone, at the cost of that order and of a second
  deploy per release.
- **Migrations** run as the one-shot `investflow-migrate` service with the
  API image; `investflow-api` waits for it to complete successfully, so a
  failed migration stops the deploy instead of looping the API. They cannot
  run in CI: reaching PostgreSQL from a runner would need a public port or
  an SSH key to the host. The API image therefore carries the Prisma CLI
  and its schema engine; their dependencies (Prisma Studio, PGlite,
  TypeScript, React) add about 200 MB to its 865 MB, a cost on disk and on
  the first pull only.
- **Configuration.** What is not secret is written in the compose file;
  Dokploy holds only `DATABASE_URL`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, and `AWS_ACCOUNT_ID`, from which the file builds
  the queue URLs. The outbox's polling and retention variables
  (`OUTBOX_POLL_MIN_INTERVAL_SECONDS`, `OUTBOX_POLL_MAX_INTERVAL_SECONDS`,
  `OUTBOX_RETENTION_INTERVAL_SECONDS`, `OUTBOX_RETENTION_DAYS`) and
  `LOG_LEVEL` pass through from Dokploy when it sets them, so they can be
  tuned without a new image; unset, the API's defaults apply. The API checks its variables when it starts and exits
  naming the ones missing or invalid
  ([Environment Configuration](./project-structure.md#environment-configuration)),
  so a bad value stops the container instead of failing a later request.
- **Memory.** Every container has a limit, and Node caps its heap below it:

  | Service                            | Limit  | Heap   | Measured                              |
  | ---------------------------------- | ------ | ------ | ------------------------------------- |
  | `investflow-migrate`               | 256 MB | 128 MB | 117 MiB peak applying every migration |
  | `investflow-api`                   | 384 MB | 256 MB | 153 MiB after a calculation           |
  | `investflow-web`                   | 32 MB  | —      | 10 MiB                                |
  | `investflow-index-values-importer` | 256 MB | 128 MB | 173 MiB peak in a run                 |

  The API and web limits are the platform's memory budget. The API's
  `stop_grace_period` is 30 s because SQS long polls last up to 20 s and
  consumers finish their work before the process exits.

- **Database pool.** `PrismaService` caps its `pg` pool at 10 connections:
  the shared instance's `max_connections` (100) is split across projects,
  and with the `pg` driver adapter a `connection_limit` URL parameter has no
  effect.

- **Index values importer.** `investflow-index-values-importer` idles on
  `sleep infinity`, because a Dokploy Compose schedule job runs its command
  with `docker exec` and needs a running container. That keeps its environment
  and image version in this file, following releases and rollbacks, which a
  Server job calling `docker run` would not. It holds only `DATABASE_URL`: the
  API publishes its events (see "Hosts" in
  [Messaging Transport](./messaging.md)). A failed run is only in the job's
  logs and waits for the next run. Procedures are in the
  [runbook](../../infra/dokploy/README.md).

## Images

- **Build once.** A release runs `pnpm check` and prunes the API and the
  importer in CI, and the Dockerfiles only copy `dist/` and install production
  dependencies, so the shipped build is the tested one. A local
  `docker build` needs the prune (or `web:build`) first. A root
  `postinstall` generates the Prisma client, so a fresh clone passes
  `pnpm check` with no setup.
- **`apps/api/package.json` is the artifact's dependency list.** The pruned
  `package.json` is copied from it, so it lists what the bundle requires at
  run time, including the Prisma CLI and `dotenv` for migrations. pnpm 10
  runs install scripts only for an allowlist read at a workspace root, so
  the Dockerfile writes its own `pnpm-workspace.yaml` allowing `prisma` and
  `@prisma/engines`, which download the schema engine.
- **Public images** in GHCR, `ghcr.io/diogo-nb/investflow-api`,
  `-web`, and `-index-values-importer`. The repository is public and the images hold no secret, so the
  VPS pulls without registry credentials; a private image would need a
  classic token that reads every package of the account.
- **Base images** match `.nvmrc` (`node:22.22.1-bookworm-slim`, with
  `openssl`, which Prisma probes to pick its engine) and run unprivileged
  (`nginxinc/nginx-unprivileged`).

## Releases

- **Pull requests only** (2026-10-31). A ruleset on `main` requires a pull
  request with a green **CI** check (`ci.yml`: `pnpm check` and the API
  prune), linear history, and squash merges, and blocks force pushes and
  deletion, with no bypass. It requires no approval: GitHub does not let
  authors approve their own pull requests, and with one collaborator a
  required approval would need a bypass that also skips CI. Require one
  approval when a second collaborator joins.
- **Release Please** (2026-10-31). Every push to `main` runs
  `release-please.yml`, which keeps a release pull request with the next
  version and `CHANGELOG.md`, computed from the Conventional Commit
  messages on `main`; squash merges make the pull request title that
  message. Merging the release pull request is the release approval: it
  publishes the GitHub release `vX.Y.Z`, which creates the tag. Release
  Please acts with a GitHub App's token because pull requests and releases
  made with `GITHUB_TOKEN` start no workflows: the release pull request
  would never get its required check and the release would never deploy. A
  personal access token would work too, but expires and acts as its owner.
  A ruleset on `v*` tags lets only that App create, move, or delete them,
  so nothing deploys outside Release Please. Before 1.0 a breaking change
  bumps the minor version.
- **Trigger.** A published `vX.Y.Z` release on `main` runs `release.yml`: one job checks,
  prunes, and pushes all images as `:vX.Y.Z` (one job, because artifact
  uploads drop the pruned output's empty `workspace_modules`), then
  `deploy-production.yml` deploys. `rollback.yml` deploys an earlier
  version, but not one older than the importer image, whose tag would be
  missing. Both share one non-cancelling concurrency group, so deploys never
  overlap. Actions are pinned to commit SHAs.
- **Source archive** (2026-11-03). A published release also runs
  `source-archive.yml`, which attaches `investflow-vX.Y.Z-source.zip`
  (`git archive` of the tag) and its SHA-512 (`.sha512`, `sha512sum`
  format) to the release. The hash is what a software registration with the
  INPI files; the zip is the copy it proves, so it is published rather
  than relying on GitHub's generated source archives, whose bytes are not
  guaranteed stable. It is a separate workflow so it neither waits for nor
  affects the deploy, and it never replaces an existing asset: a re-run
  fails instead of changing an archive whose hash may already be filed.
  Releases up to `v0.4.0` have no archive.
- **Version selection.** Dokploy reads the compose file from `main`, so it
  names a moving tag, `:production`, pulled on every deploy. A deploy points
  `:production` at the version, then calls Dokploy. Setting an `IMAGE_TAG`
  from CI was rejected: Dokploy stores the environment as one string with
  the secrets, so CI would have to read and rewrite them; committing image
  digests to the compose file was rejected as more machinery than needed.
  Tradeoffs: Dokploy shows `:production`, not the version (the last
  successful release or rollback run says which), and a compose change on
  `main` after the tag deploys with older images; requiring the tag to be on
  `main` narrows that window.
- **Deploy call.** CI calls the Dokploy API (`POST /api/compose.deploy`)
  once, with the key of a Dokploy member limited to the `investflow`
  project, and does not wait: Dokploy queues the deploy, and its outcome is
  in Dokploy's logs. Autodeploy stays off. The deploy webhook cannot replace
  the API: it refuses while autodeploy is off and, with it on, accepts only
  requests shaped like GitHub push events.
- **Forward-only migrations.** A rollback runs the older images against the
  current schema, so a version can be rolled back to only if it works with
  every migration released after it.

## AWS

- **Stack.** `InvestflowMessagingStack` (AWS CDK in TypeScript, Nx project
  `infra-aws` in [`infra/aws`](../../infra/aws)) is deployed by hand; CI holds
  no AWS credentials. What it creates, and how its spec keeps it identical to
  local provisioning, is in "Production provisioning" in
  [Messaging Transport](./messaging.md).
- **Credentials.** The API authenticates as the IAM user `investflow-api`
  with an access key stored only in Dokploy, created by hand so the secret
  never enters CloudFormation. Its policy works only from the VPS's public
  IPv4 (`aws:SourceIp`), so a leaked key is useless elsewhere; the VPS
  reaches AWS over IPv4 only (checked 2026-10-31). IAM Roles Anywhere would
  replace the key with one-hour credentials from a certificate, at the cost
  of a CA, a credential helper in the image, and certificate renewal (see
  [Production Hardening](../implementation/planned/production-hardening.md)).
- **The Nx CDK targets drop the Floci settings** (`AWS_ENDPOINT_URL`, the
  test key pair, `AWS_REGION`) that Nx loads from `.env` into every task;
  otherwise CDK would ask Floci for the account and fail.
