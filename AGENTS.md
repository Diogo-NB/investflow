# Repository Guidelines

## Project Overview

InvestFlow is a NestJS 11 modular monolith managed with Nx and pnpm, with a
React 19 + Vite SPA. Deployable hosts live under `apps/`. Business
capabilities live under `libs/<context>/`, split into `domain`,
`application`, and `infrastructure` Nx projects plus an optional `web`
project. Cross-context building blocks belong in `libs/shared`.
Infrastructure and identity setup live under `infra/`.

The project demonstrates Event-Driven Architecture and DDD solving real
production problems at scale. Judge designs as production-grade examples, not
by today's data volume: do not rely on small volumes (such as one transaction
proportional to the affected rows), prefer well-known named patterns, and
state their tradeoffs.

## Agent Skills

Skills are chosen by the files a change touches, not by how the request is
worded. Before creating or editing a file that matches a line below, load that
line's skill, even in the middle of a task that started elsewhere. A change
usually matches several lines; load each. Planning or discussing a change
counts as touching its files: load the skills before proposing a design. In
Claude Code a hook blocks edits to matching files until their skill is
loaded; nothing enforces it for planning.

- `investflow-domain-application`: `libs/*/domain/**`, `libs/*/application/**`.
- `investflow-nestjs-infrastructure`: `libs/*/infrastructure/**`, `apps/api/**`.
- `investflow-eventing`: `*.events.ts`, `*.event.ts`, `*.consumer.ts`, `libs/shared/infrastructure/src/lib/messaging/**`, `unit-of-work*`, `infra/floci/**`, or code that raises, records, or consumes an event (`apply(new`, `.record(`, `@OnEvent`).
- `investflow-react`: `apps/web/**`, `libs/*/web/**`.
- `investflow-outbox-benchmark`: `tools/benchmarks/**`.

Skills for kinds of work rather than files:

- `investflow-planning` for any plan, design discussion, or decision, and
  for updating the docs once decisions are made.
- `investflow-local-testing` to test changes on the local development
  stack: starting it, API calls with a local Keycloak token, database rows,
  and browser testing.
- `investflow-outbox-benchmark` to run, interpret, and report the outbox
  publishing benchmark (`pnpm bench:outbox`).

Vendored frontend skills (tracked in `skills-lock.json`) supplement
`investflow-react`, which takes precedence over them: `react-router` for
routing (this app uses Data mode) and `vercel-composition-patterns` for
component API design.

## Docs

`docs/README.md` lists every doc, what it owns, and when to read it. Read the
file, or the section, a change needs rather than whole folders. Each fact has
one home: other files link to it instead of restating it. Recorded decisions
are revisable; check that their premises still hold.

## Architecture Invariants

- Apps are thin composition roots; business behavior stays in its bounded
  context.
- Domain code is framework-free and depends only on domain projects;
  application code depends only on domain and application projects. Lint
  enforces both.
- Bounded contexts communicate through integration events or explicit
  contracts, never by importing one another's internals. Shared libraries
  cannot depend on feature contexts.
- Export every library's public API through `src/index.ts`; use workspace
  aliases across projects and relative imports within a project.
- Organize bounded-context source feature-first in every layer (plural roots
  such as `offers` and `simulations`) and shared projects capability-first
  (`dates`, `rates`, `messaging`, `persistence`, `foundations`). Never
  global type buckets such as `value-objects`, `services`, or `validators`.
- Domain and application code use `CalendarDate`, `CalendarDateRange`, and
  `UtcInstant` from `@investflow/shared-domain` and get time from the `Clock`
  port. Native `Date` exists only at infrastructure boundaries, converted
  immediately.
- No `createdAt` or `updatedAt` on aggregates or entities only for technical
  auditing; temporal fields belong in the domain only when a rule, transition,
  or calculation uses them.
- Offers and curves are mutable; simulations reference them and are
  recalculated asynchronously when they change
  (`docs/architecture/recalculation.md`).
- Events are recorded in the unit of work, published after commit through
  the outbox, and delivered over EventBridge to SQS FIFO queues grouped per
  aggregate; correctness relies on that exclusivity, not on delivery order
  (`docs/architecture/messaging.md`).
- Screens read through screen-oriented queries that compute business facts
  on the server, never layout or formatting (`docs/architecture/queries.md`).
- There is one frontend app, `apps/web`; browser code stays in it or in the
  owning `libs/<context>/web` project and is never extracted into reusable Nx
  libraries.
- The web page limits dates to the current year ± 100; the API accepts any
  date.
- Pending and postponed work is in `docs/implementation/planned/`; check it before
  touching an area it names.

## Build, Test, and Development Commands

Use Node.js 22.x LTS, pnpm 10, and Docker. Load Node first with
`source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use`; if pnpm is missing after
installing a Node version, run `corepack enable`. Where Unix sockets are
prohibited, prefix Nx commands with `NX_DAEMON=false`. Run tasks through
`pnpm nx` rather than the underlying tools.

- `pnpm install`: install workspace dependencies.
- `pnpm db:up` / `db:down`: start or stop PostgreSQL, Keycloak, and Floci, keeping local data (Floci reprovisions its in-memory resources on start).
- `pnpm db:setup`: delete local PostgreSQL and Keycloak state, recreate the services, migrate, import the realm, and seed.
- `pnpm db:migrate`: create and apply a Prisma migration after a schema change.
- `pnpm db:generate`: regenerate the Prisma client.
- `pnpm start`: start the containers, then serve the API and web app (`start:api`, `start:web` for one).
- `pnpm test`: all unit tests (Jest for backend, Vitest for frontend).
- `pnpm check`: lint, unit test, typecheck, and build every project. Needs nothing but the repository, so it runs anywhere, including CI.
- `pnpm check:integration`: `pnpm check`, then the integration tests (`*.integration.spec.ts`) against a migrated test database (`INTEGRATION_TEST_DATABASE_URL`) and Floci. Needs `pnpm db:up`; fails, never skips.
- `pnpm bench:outbox`: measure how long committed events wait to be published (API stopped).

Check `pnpm nx <command> --help` before unfamiliar flags. Scaffold with Nx
generators and preserve project tags.

## Coding Conventions

TypeScript uses Prettier with single quotes and the Nx flat ESLint
configuration. Format only the files you changed
(`pnpm prettier --write <file>…`), never a folder: `pnpm check` does not
enforce formatting, so formatting a folder rewrites unrelated files. Use
kebab-case filenames, PascalCase classes, and camelCase methods and
variables. Prefix every enum name with `E` (`ETitleType`, `EAppErrorCode`).
Prefer guard clauses.

Name things for what they are and where they apply, so a reader does not
need the body or the docs to know: types, methods, events, endpoints, routes,
files, and skills. Avoid generic words (`verify`, `handle`, `process`,
`impact`, `data`, `Changed`) unless qualified by their scope
(`investflow-local-testing`, not `investflow-verify`). Name booleans as a
positive state the caller checks (`isUnchanged`, `isFixed`). Endpoint paths
name the resource they return, not why the caller wants it (an offer's
simulations are `/simulations?offerId=`, not `/offers/:id/impact`). When a
name stops fitting after a change, rename it in the same change.

Use `unknown` for untrusted input and narrow it explicitly; use precise types
for internal inputs. No `any` unless unavoidable framework typing requires
it.

Do not put small functions in dedicated files to share them. Behavior lives
with its owner: a private method or local function in the file that uses it,
a method or static on the aggregate, value object, or domain service that owns
the rule, or a method on a port when several services need the capability.
One-line logic stays inline at each call site. A standalone shared function
file is acceptable only for a true utility that computes no business rule, is
domain agnostic, and receives no port, such as
`libs/investment-simulator/web/src/lib/decimals/format-decimal.ts`.

`AppError` messages are user-facing, concise pt-BR that clients show as is;
the stable `code`, a member of `EAppErrorCode`, is the contract for behavior
and tests.

Code under `tools/` (the seed, benchmarks) meets the same bar as library
code; `tools/database/seed.ts` is the reference. Keep the entry file to
composition and `main()`, with cohesive modules in a folder beside it. Parse
command-line input once into typed options with a usage text, return named
result types, define a report's columns once, avoid import-time side effects,
and reach the system through its public APIs. Add a new tool's
`tsconfig.json` to the `tools` project's `typecheck` target.

Comment only what the code cannot say: a non-obvious constraint, side effect,
workaround, ordering or format guarantee, or why an apparently simpler option
is wrong. Do not restate a name or signature, summarize what a declaration
does, give example outputs, label a section, or cite decisions and dates.
Doc comments (`/** */`) follow the same rule.

The workspace retains `baseUrl` because the Nx TypeScript executor needs it
for path aliases. Use the workspace TypeScript version from
`.vscode/settings.json`; do not add `ignoreDeprecations`.

## Testing Guidelines

Place focused tests in a `test/` folder beside the source they cover
(`*.spec.ts`, or `*.spec.tsx` with JSX), with fixtures used only by them;
when the folder would hold one file, keep it beside the source. The layer
skills say what each layer tests.

### Done means

Iterate with the affected projects' targets (`pnpm nx run <project>:test`,
`:lint`, `:typecheck`). Before reporting a change as done, run every line
it matches:

- **Domain or application only:** `pnpm check`.
- **HTTP, DTOs, modules, host composition:** `pnpm check`; the changed endpoints on the local API (`investflow-local-testing`).
- **Persistence: repositories, mappers, query handlers, Prisma schema, migrations:** `pnpm check:integration`; the endpoints and the rows they wrote on the local stack.
- **Events, consumers, outbox, unit of work, messaging:** `pnpm check:integration`; the asynchronous flow on the local stack (outbox rows, `processed_events`, end state).
- **Outbox publishing path (relay, poller, publisher, broker adapter, unit of work):** Also `pnpm bench:outbox` before and after (`investflow-outbox-benchmark`).
- **Frontend:** `pnpm check`; the browser checks in "Testing and verification" in `docs/architecture/frontend-patterns.md`.
- **Dependencies:** `pnpm check`; `pnpm nx run api:prune` so browser packages stay out of the API artifact.
- **Docs or skills only:** Re-read the changed files against each other; the same fact is not stated differently in two places.

When existing code gets in the way (a layout that breaks, state that does
not match the server, a rule the code already violates), analyze it and fix
or report it; do not route around it and explain the detour in a comment.
The obstacle is often the real finding: a remove button stacked under the
offer name "so the fixed columns keep their width" hid a table that already
broke at 1024px.

Browser testing on a backend-only change is proposed with its rationale and
waits for approval. Report what ran, what was skipped, and why; never claim
a check that did not run.

## Commit & Pull Request Guidelines

Follow Conventional Commits (`feat: ...`, `fix: ...`), scoped and imperative.
Pull requests explain behavior changes, name the affected contexts, include
validation commands and request/response examples for API changes, and call
out schema migrations or configuration changes.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating or exploring the workspace, inspect `nx.json` and the relevant
  `project.json` files, then use `pnpm nx show projects` and
  `pnpm nx show project <project>` as needed.
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- Use Nx MCP tools when they are available.
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

### Scaffolding & Generators

- Use Nx generators for scaffolding tasks and inspect the generator options with
  `pnpm nx generate <generator> --help` before running unfamiliar generators.
- Preserve the workspace's existing project tags and dependency boundaries.

### When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- Use generator `--help` for basic syntax and option discovery.

<!-- nx configuration end-->
