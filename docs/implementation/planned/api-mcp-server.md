# API MCP Server

> **Status: pending, not started.** Registered 2026-10-30 as an idea; its
> decisions are still open (see "Decisions needed first"). Delete this file
> once it ships and its outcome is in [Current State](../current-state.md).

An MCP (Model Context Protocol) server that lets an AI assistant such as
Claude Code use the InvestFlow API on a user's behalf: list and create
offers and curves, simulate investments, and compare simulations.

It is a thin host under `apps/` (for example `apps/mcp`) that calls the HTTP
API, never the application layer, so authentication, validation, and
per-user scoping stay in the API (see "Applications And Libraries" in
[Project Structure](../../architecture/project-structure.md)).

## Decisions needed first

- **Transport and authentication.** Options discussed 2026-10-30:
  - A local stdio server that gets a user token from Keycloak with the
    password grant on the `investflow-api` client and refreshes it (leading
    option to start; local use only).
  - A remote Streamable HTTP server with the MCP authorization flow and
    Keycloak as the authorization server: a dedicated MCP client in the
    realm, redirect URIs, and an audience mapping so the API accepts its
    tokens. Needed only if others use it.
  - A service account does not fit: data is scoped to the token's `sub`, so
    it would see its own empty data set unless it impersonates the user
    (token exchange).
- **Tool schemas.** The API has no OpenAPI document. Either hand-write the
  tool schemas (leading option: fewer, task-shaped tools describe intent
  better than one tool per route) or add `@nestjs/swagger` and generate
  them. The offer terms are unions discriminated by `kind` and need explicit
  JSON Schema and descriptions either way.
- **Tool set.** Which tasks become tools (around ten to start, such as
  creating an offer, simulating an investment in an offer, and comparing
  simulations), and whether read models are also exposed as MCP resources.

## Scope

- Tools hide two API mechanics a model handles poorly:
  - Edits send the revision they were loaded with and fail with `409` on a
    conflict (see "Screen mechanics" in
    [Frontend Patterns](../../architecture/frontend-patterns.md)); an edit
    tool loads, applies the change, and retries once on a conflict.
  - Simulations recalculate asynchronously after an offer or curve changes
    ([Recalculation](../../architecture/recalculation.md)); a tool that
    returns results reports a pending `calculationStatus` or waits for it to
    settle, never presents stale results as current.
- `AppError` codes and messages are passed through so the model can act on
  them.

## Done when

An MCP client registered against the local stack can, as the signed-in
user, create an offer, simulate an investment in it, edit the offer, and
read the recalculated result, with tests covering token refresh, the
revision retry, and the pending-result case.
