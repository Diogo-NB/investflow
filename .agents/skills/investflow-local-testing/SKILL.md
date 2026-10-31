---
name: investflow-local-testing
description: Test InvestFlow changes manually on the local development stack (Docker PostgreSQL, Keycloak, and Floci, with the API and web served from this machine) after the automated tests pass. Use to start or stop the local stack, get a local Keycloak token, call the local API with curl, inspect local PostgreSQL rows, outbox events, and queues, or test the local web app in a browser with Playwright. Also use to diagnose local environment failures such as a port already in use, a stuck Nx serve, or AWS credential errors against Floci. Do not use for writing unit tests, the outbox benchmark, or any deployed or real AWS environment.
---

# InvestFlow Local Testing

Automated tests prove the code; this skill exercises the change on the local
development stack. A backend change is not done until its endpoints were
called on the local API and the rows they wrote were checked.

Everything here targets this machine: Docker containers, `localhost` ports,
and `.env` credentials meant for development. It never applies to a deployed
or real AWS environment. When a behavior can only be confirmed on real AWS
(Floci gaps, such as FIFO message groups), say so and ask the user, who can
set up a homolog environment.

## Order

1. Run the automated checks in "Done means" in `AGENTS.md`.
2. Verify the backend alone: start the API, call the endpoints, query the
   database. This is the default for backend work.
3. Browser testing with Playwright is expensive. On backend tasks, propose it
   with a short rationale and wait for approval. On frontend tasks it is part
   of verification. When the request says what to test or not to test (for
   example "no stress or metrics"), follow it exactly.

## Environment

Load Node first: `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use`.

Before starting anything, check what already runs:

```bash
docker ps --format '{{.Names}} {{.Status}}'   # investflow-db, -keycloak, -floci
ss -ltnp | grep -E ':(3000|4200|5432|8080|4566)\b'
```

- Docker unavailable: stop and tell the user; do not work around it.
- Containers down: `pnpm db:up`. An empty or broken database: `pnpm
db:setup` resets it (only when the user allows resetting local data), then
  `pnpm db:seed` loads the system curves and offers.
- API: `pnpm start:api` in the background; ready when
  `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api` answers. Web:
  `pnpm start:web` (port 4200). `pnpm start` runs containers, API, and web.
- Reuse a server the user already started; never start a second one.

Stop every process you started before finishing, and only those.

### Known failures

- `EADDRINUSE :3000` or "Waiting for api:serve:development in another nx
  process": an earlier serve is still alive. Find it with `ss -ltnp` or
  `pgrep -af 'nx.*serve'`, and stop it if you started it; otherwise ask.
- `CredentialsProviderError` or "Multiple credential sources detected"
  against Floci: a shell `AWS_PROFILE` overrides the `.env` key pair. Run
  the API with `env -u AWS_PROFILE`, and tell the user if it is set in their
  shell profile.
- Floci keeps resources in memory and reprovisions them on start; messages
  in flight are lost when it restarts.

## Backend

The API listens on `http://localhost:3000/api`, with routes under
`/api/investment-simulator/...`. Get a token for the development user with
the API client's password grant (values from `.env`). The client secret is
the local realm's, literally `**********`: Keycloak masks secrets on export,
and the masked value became the secret on import. The API itself needs no
secret.

```bash
set -a; . ./.env; set +a
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token" \
  -d grant_type=password -d client_id="$KEYCLOAK_CLIENT_ID" \
  --data-urlencode 'client_secret=**********' \
  -d username=investflow-dev -d password=investflow-dev | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/investment-simulator/simulations | jq
```

The Keycloak admin console login (`KC_ADMIN`/`KC_ADMIN_PASSWORD`, admin/admin)
is for managing the realm, not for calling the API.

For every changed endpoint, check:

- the success path, and the response shape against the query's output
  contract (ISO dates, decimal strings);
- each expected failure: status, stable `code`, and pt-BR `message`;
- owner scoping: data of another user or system content is not editable;
- the database afterwards:
  `psql "$DATABASE_URL" -c '...'` (strip `?schema=public` if psql rejects
  it), or `docker exec investflow-db psql -U postgres investflow`.

For asynchronous flows, also check that `outbox_events` rows were written
and marked published, that `processed_events` recorded the consumer, and
that the final state was reached (for example the simulation status moved
from `PENDING` to `CALCULATED`). Poll with a timeout instead of sleeping a
fixed time.

For scale checks ("hundreds of simulations"), script the requests with a
loop, report rough timings per item and per hundred, and keep the script in
the scratchpad unless the user wants it as a tool under `tools/`.

## Browser

Use the Playwright MCP tools against `http://localhost:4200`, logging in on
the Keycloak page as `investflow-dev` / `investflow-dev`.

- Read the console throughout. Every error or warning from the app is a
  finding; known framework noise (React DevTools notice) is not.
- Test as the user would: the scenario described in the request, edge cases
  around it (empty, many rows, invalid input, delete in the middle, undo),
  and a narrow 390px viewport for screens with forms or tables.
- Report each step as pass or fail, with a screenshot and the exact console
  output for failures, plus anything confusing or ugly you noticed.
- Save screenshots in the scratchpad. Delete the `.playwright-mcp/` folder
  the tool creates in the repository.
- Leave test data in place unless the user asks for cleanup; it is local
  development data.

## Report

State what ran and what it showed: commands, endpoints, rows checked, and
anything you could not verify and why. Do not claim a check you did not run.
