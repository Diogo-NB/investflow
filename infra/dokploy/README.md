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

## Load the BCB system curves

A one-off that creates the CDI and SELIC system curves, until the
[BCB rate import](../../docs/implementation/planned/bcb-rate-import.md) keeps
them current. Remove `apps/api/src/load-bcb-system-curves` and its entry in
`apps/api/webpack.config.js` once it has run, along with this section.

From a shell on the VPS, after the release containing it is deployed:

1. Set `DATABASE_URL` from Dokploy's environment and back up. Its host
   resolves only on `dokploy-network`, and `pg_dump` rejects Prisma's
   `schema` parameter:

   ```sh
   docker run --rm --network dokploy-network postgres:17 \
     pg_dump -Fc "${DATABASE_URL%%\?*}" > investflow-before-curves.dump
   ```

2. Dry run, which applies the domain rules and writes the curves, then rolls
   back before the outbox rows are written:

   ```sh
   docker run --rm --network dokploy-network -e DATABASE_URL="$DATABASE_URL" \
     ghcr.io/diogo-nb/investflow-api:vX.Y.Z node load-bcb-system-curves.js
   ```

   Expect 16 intervals per curve, 2024-01-02 to 2026-10-30.

3. Repeat with `--commit` after `load-bcb-system-curves.js`. A later run
   refuses to write while the curves exist.
4. Check that `/curvas` lists both under "Do sistema" for a normal user, and
   that their two `CurveCreated` rows in `outbox_events` get a `published_at`
   from the running API.

Delete the dump once the curves are confirmed. System curves are read-only on
the screens and no tool edits or deletes them, so review the values before
committing. Fixing one afterwards needs a change released through the edit or
delete use case as the system actor; restoring the dump also discards everything
written since it was taken.

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
