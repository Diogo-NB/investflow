# Production runbook

How to release, roll back, and set up InvestFlow's production deployment.
What runs where, and why, is in
[Production Deployment](../../docs/architecture/deployment.md).

## Release

1. Merge pull requests to `main` with a Conventional Commit title
   (`feat: …`, `fix: …`): the squash commit takes it, and Release Please
   reads it to pick the version and write the changelog.
2. Release Please keeps a `chore(main): release X.Y.Z` pull request open
   with the version bump and `CHANGELOG.md`. Merge it once CI is green to
   release; it publishes the GitHub release `vX.Y.Z`.
3. The **Release** workflow checks, publishes both images as `:vX.Y.Z`,
   points `:production` at them, and asks Dokploy to deploy. A green run
   means Dokploy queued the deploy; whether it succeeded is in the compose
   service's **Deployments** tab in Dokploy.
4. Check `https://investflow.diogo-nb.com.br/api/health-check`.

## Roll back

Actions → **Rollback** → Run workflow with the version to restore. It
rebuilds nothing: it points `:production` at that version and deploys.
Migrations are not undone, so the version must work with the current
schema; check the migrations released since it before rolling back past
one.

The same workflow with the current version redeploys without a release, for
example after changing the Dokploy environment or domains. The compose
service's **Deploy** button in Dokploy does the same.

## Import the index values

`investflow-index-values-importer` stores what the Banco Central published and
updates the `CDI` and `SELIC` system curves through the API; the target SELIC
(`SELIC_TARGET`) is only stored. Before its first
release, run `pnpm nx run infra-aws:deploy` for its queue, and confirm `/curvas`
lists both curves, named exactly that, under "Do sistema"; without them, every
event dead-letters.

1. Once for each index, after the release, from a shell on the VPS, starting
   the day after the curves end (2026-10-30):

   ```sh
   docker exec <importer container> node main.js --index=CDI --start-date=2026-10-31
   docker exec <importer container> node main.js --index=SELIC --start-date=2026-10-31
   ```

   The target SELIC has no earlier history to load, so its first run starts on
   the day it runs. Run it in the morning, São Paulo time (see "Dates ahead of
   today" in [Messaging Transport](../../docs/architecture/messaging.md)):

   ```sh
   docker exec <importer container> node main.js --index=SELIC_TARGET --start-date=<today>
   ```

   A run without `--start-date` starts the day after the last stored date. A
   start date already stored fails the run, and a later one leaves a gap: the
   curve keeps the previous rate over the missing days.

2. In Dokploy, add one **Compose** schedule job per index on the service
   `investflow-index-values-importer`, on weekdays, at the hours below, in São Paulo time.

   | Index        | Command                             | Time  | Cron           |
   | ------------ | ----------------------------------- | ----- | -------------- |
   | SELIC        | `node main.js --index=SELIC`        | 09:00 | `0 9 * * 1-5`  |
   | SELIC_TARGET | `node main.js --index=SELIC_TARGET` | 09:30 | `30 9 * * 1-5` |
   | CDI          | `node main.js --index=CDI`          | 12:00 | `0 12 * * 1-5` |

   The SELIC and CDI values appear in the API the morning after their date: SELIC was there
   by 08:36 and the CDI by 11:26 in the one day sampled. A value that arrives
   after its job's run waits for the next day's run, so check the first runs and
   move a job later if needed, but keep the jobs apart: they share one 256 MB
   container and a run peaks at 173 MiB. Monday's `SELIC_TARGET` run also stores
   the weekend, and a value after a Copom decision waits for the Banco Central
   to publish it. A run before step 1 fails with
   "Informe a data inicial" and writes nothing.

3. Check that a run logs `SELIC: imported` or `CDI: imported`, and that a new
   value appears in `published_index_value` and moves the curve's end within
   about a minute, once the API's poller publishes it. A `SELIC_TARGET` run moves
   no curve.

A failed run exits with 1, shows only in the job's logs, and the next run
catches up. A message in `curve-published-index-values-dlq.fifo` can be moved
back with an SQS redrive within its 14-day retention, but changes nothing if a
later value was already applied (see "Published index values" in
[Messaging Transport](../../docs/architecture/messaging.md)).

## Dokploy setup

The `investflow` project holds one **Compose** service (type Docker
Compose, not Stack):

- **Source:** Git, `https://github.com/Diogo-NB/investflow.git`, branch
  `main`, compose path `./infra/dokploy/compose.yaml`. Autodeploy off;
  isolated deployment off, since the file joins `dokploy-network` itself.
- **Environment:** `DATABASE_URL`
  (`postgresql://investflow:<password>@<internal host>:5432/investflow?schema=public`,
  the internal host from the PostgreSQL service in the `platform` project),
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`.
- **Domains**, both on `investflow.diogo-nb.com.br` with HTTPS and Let's
  Encrypt:

  | Service          | Path   | Internal path | Port | Strip path |
  | ---------------- | ------ | ------------- | ---- | ---------- |
  | `investflow-web` | `/`    | `/`           | 8080 | off        |
  | `investflow-api` | `/api` | `/`           | 3000 | off        |

  An internal path of `/api` on the API domain doubles the prefix: Nest
  then receives `/api/api/...` and answers 404.

- **CI access:** a Dokploy member with access only to the `investflow`
  project and API access allowed, whose API key CI uses. Called with that
  key, `GET /api/project.all` lists only `investflow`.

Domain and environment changes take effect on the next deploy.

## GitHub setup

- **Release App:** a GitHub App on the owner's account, installed on this
  repository only, with webhooks off and the repository permissions
  Contents, Pull requests, and Issues (labels) set to read and write. The
  repository variable `RELEASE_APP_CLIENT_ID` holds its client ID and the
  secret `RELEASE_APP_PRIVATE_KEY` a private key generated in its settings.
- **Ruleset `main`:** targets the default branch with no bypass; requires a
  pull request (squash only, zero approvals), the status check `Check`,
  and linear history; blocks force pushes and deletion.
- **Ruleset `release tags`:** targets `refs/tags/v*`, restricts creation,
  updates, and deletion, with the Release App as the only bypass actor.

The `production` environment, limited to `v*` tags, holds the variables
`DOKPLOY_URL` (`https://dokploy.diogo-nb.com.br`) and `DOKPLOY_COMPOSE_ID`
(the last part of the compose service's URL in Dokploy) and the secret
`DOKPLOY_API_KEY`. Both GHCR packages must be public.

## AWS

Sign in to the account first; the stack lives in `sa-east-1`.

- **Change the stack:** edit `infra/aws`, then review and deploy:

  ```sh
  pnpm nx run infra-aws:diff -- --profile <profile>
  pnpm nx run infra-aws:deploy -- --profile <profile>
  ```

  CDK asks to confirm IAM changes, so run the deploy interactively.

- **Rotate the API's access key:**
  1. `aws iam create-access-key --user-name investflow-api` (a user holds
     up to two keys).
  2. Put the new pair in Dokploy's environment and redeploy.
  3. Once the API is healthy, delete the old key with
     `aws iam delete-access-key --user-name investflow-api --access-key-id <old id>`.

- **Move to another server:** the API's key works only from the VPS's IP.
  Change `API_SOURCE_IP` in `infra/aws/src/messaging/messaging.stack.ts`
  and deploy the stack before moving the API, alongside the
  `vps.diogo-nb.com.br` record in personal-platform's DNS stack.
