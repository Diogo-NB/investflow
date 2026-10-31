# Production Hardening

> **Status: postponed.** Left out of the first production deployment
> (2026-10-31) to keep it small; each item stands alone. Revisit an item
> when its trigger below happens, and delete this file once none remains.

The deployment these build on is in
[Production Deployment](../../architecture/deployment.md).

## Scope

- **Checks on pull requests.** A workflow that runs `pnpm check` on every
  pull request, so a broken `main` shows before a release tag. Revisit when
  changes start arriving through pull requests.
- **Dead-letter alarms.** Alarms (CloudWatch, with a notification) when
  `simulation-calculations-dlq.fifo`, `simulation-recalculations-dlq.fifo`,
  or `event-delivery-dlq` receives a message; today they are only seen by
  looking. Revisit before anyone else depends on the site.
- **IAM Roles Anywhere** instead of the `investflow-api` access key: a
  certificate from a self-managed CA, exchanged for one-hour credentials by
  AWS's signing helper in the API image. Revisit if the key's IP restriction
  stops being enough, such as when the API runs on several servers.
- **A `staging` environment**, a second Dokploy environment and AWS stack
  that a release deploys to before production. Revisit when changes need
  testing on real infrastructure before users see them; it also needs room
  in the VPS memory budget.
- **A Content Security Policy** in `apps/web/nginx.conf`, allowing the site
  itself and `auth.diogo-nb.com.br` for the Keycloak login.

## Done when

Each item is either built and recorded in the deployment doc or dropped
with its reason.
