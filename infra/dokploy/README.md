# Production runbook

How to release, roll back, and set up InvestFlow's production deployment.
What runs where, and why, is in
[Production Deployment](../../docs/architecture/deployment.md).

## Release

1. Merge to `main`, then tag the commit and push the tag:

   ```sh
   git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
   ```

2. The **Release** workflow checks, publishes both images as `:vX.Y.Z`,
   points `:production` at them, and asks Dokploy to deploy. A green run
   means Dokploy queued the deploy; whether it succeeded is in the compose
   service's **Deployments** tab in Dokploy.
3. Check `https://investflow.diogo-nb.com.br/api/health-check`.

## Roll back

Actions → **Rollback** → Run workflow with the version to restore. It
rebuilds nothing: it points `:production` at that version and deploys.
Migrations are not undone, so the version must work with the current
schema; check the migrations released since it before rolling back past
one.

The same workflow with the current version redeploys without a release, for
example after changing the Dokploy environment or domains. The compose
service's **Deploy** button in Dokploy does the same.

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
