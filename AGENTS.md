# Repository Guidelines

## Project Overview

InvestFlow is a NestJS 11 modular monolith managed with Nx and pnpm. Deployable
hosts live under `apps/`. Business capabilities live under `libs/<context>/`
and are split into `domain`, `application`, and `infrastructure` Nx projects;
browser presentation uses an optional `web` project. Cross-context building
blocks belong in `libs/shared`. Infrastructure and identity setup live under
`infra/`.

## Agent Skills

Load the repository skill that matches the work:

- `$investflow-domain-application` for aggregates, value objects, domain
  services, use cases, ports, application errors, and temporal behavior.
- `$investflow-nestjs-infrastructure` for controllers, DTOs, Prisma adapters,
  query handlers, Nest modules, dependency injection, and host composition.
- `$investflow-eventing` for domain events, the transactional outbox,
  EventBridge/SQS, consumers, retries, and idempotency.
- `$investflow-react` for routes, components, hooks, forms, browser API
  clients, state, styling, accessibility, and frontend tests.

Vendored frontend skills (tracked in `skills-lock.json`) supplement
`$investflow-react`:

- `$react-router` for routing (this app uses Data mode).
- `$vercel-composition-patterns` for component API design.
- `$vercel-react-best-practices` for performance work and reviews.

Cross-layer changes can require more than one skill. Repository conventions in
`$investflow-react` and `docs/architecture/frontend-patterns.md` take precedence
over vendored skills: this is a client-only SPA (ignore server, RSC, and
Next.js rules), use Nx generators, retain installed package and toolchain
versions unless an upgrade is explicitly requested, and follow the state-first
frontend testing policy.

## Architecture Invariants

- Apps are thin composition roots; business behavior stays in its bounded
  context.
- Domain code is framework-free and cannot depend on application or
  infrastructure code.
- Bounded contexts communicate through integration events or explicit
  contracts, never by importing one another's internals.
- Shared libraries cannot depend on feature contexts.
- InvestFlow has a single frontend app, `apps/web`. Keep browser code in that
  app or the owning `libs/<context>/web` project. Reuse within those projects
  uses local folders and relative imports; do not extract frontend types,
  components, state, or utilities into reusable Nx libraries. Backend shared
  libraries remain separate from frontend code.
- Export every library's public API through `src/index.ts`; use workspace
  aliases across projects and relative imports within a project.
- Infrastructure query handlers query persistence directly without loading
  aggregates and own their operation-specific input/output contracts. Keep
  contracts, Prisma selections, and any private `toOutput()` mapping in the
  handler file. Outputs are plain read data with ISO date strings and precise
  decimal strings; do not expose ORM types or require separate read-model files
  or presenters. Add a presenter only for a distinct transport representation.
  Keep throwing query conversions inside `Result.fromPromise()`, and return
  Results from controllers for the global HTTP interceptor to unwrap.
- Complex screens read through screen-oriented queries (Backend for Frontend,
  decision 2026-10-10): design those query outputs for the screen's usage and
  compute business facts on the server, without backend-driven layout,
  render-ready UI structures, or presentation formatting. See
  `docs/architecture/project-structure.md`.
- Consciously postponed work is listed under "Deferred Work" in
  `docs/architecture/project-structure.md`; check it before touching an area
  it names, and remove an item when it ships.
- Organize bounded-context source feature-first in every layer. Use plural
  feature roots such as `offers` and `simulations`, then apply layer-specific
  structure below them: shallow domain models, application operation slices,
  and infrastructure boundary folders such as `http` and `persistence`.
- Organize shared projects capability-first by the same rule. Use cohesive
  roots such as `dates`, `rates`, `authentication`, `http`, `messaging`, and
  `persistence`; keep shared DDD primitives under `foundations`, and do not
  recreate global type buckets such as `value-objects`, `services`,
  `validators`, or `formatters`.
- Domain and application code use `CalendarDate`, `CalendarDateRange`, and
  `UtcInstant` from `@investflow/shared-domain`, and obtain time through the
  shared `Clock` port. Native `Date` is restricted to infrastructure boundaries
  and must be converted immediately.
- The web page accepts dates from January 1 of the current year − 100 to
  December 31 of the current year + 100 (decision 2026-10-14), because its
  calendars and date checks cannot cover every year. It is a limit of the
  page only: the API accepts any date. The page reads the business calendar
  for exactly those years once per session.
- Do not add `createdAt` or `updatedAt` to aggregates and entities only for
  technical auditing. Persistence timestamps remain an infrastructure concern;
  temporal fields belong in the domain only when business rules, state
  transitions, or calculations depend on them.
- Offers and index curves (independent revisioned aggregates, grouped only on
  screen) are mutable, private to their user or read-only system content;
  simulations always reference them and are recalculated asynchronously when
  they change (decision 2026-10-11). Reproducibility and calculation history
  were dropped. Offers, curves, and simulations are built on this model, and
  a simulation's own calculation runs asynchronously (D4a); offer and curve
  changes recalculate the simulations that use them through a fan-out (D4b). See "Mutable
  Premises And Asynchronous Recalculation" in
  `docs/architecture/project-structure.md` before touching offers, curves,
  simulations, or eventing.
- Integration events travel over EventBridge and SQS, emulated locally by
  Floci (decision 2026-10-11): one bus, one queue with a dead-letter queue per
  consumer, and transport knowledge confined to the messaging adapters.
  Queues are SQS FIFO grouped by the event's aggregate (decision 2026-10-26),
  so one message per aggregate is in flight at a time; correctness relies on
  that exclusivity, not on delivery order. See
  "Messaging Transport" in `docs/architecture/project-structure.md`; the
  visual walkthrough of the event and recalculation flow is
  `docs/architecture/event-flow.md`.
- The frontend is React 19 + Vite 8 (decision 2026-10-10). The simulation
  workspace under `/simulacoes` references offers and keeps one result, still
  calculated on save; the offer screens live under `/ofertas` and the curve
  screens under `/curvas`. Follow
  the status sequence in `docs/architecture/frontend-patterns.md`. Build features from the recorded
  behavior and design them as idiomatic React; never transliterate earlier
  implementations.
- Frontend code uses modern, stable, mainstream React: function components,
  hooks, React Router Data mode with lazy routes, TanStack Query for server
  state, React Hook Form with Zod for forms, and Base UI with Tailwind v4 for
  interaction primitives. Experimental, canary, `unstable_*`, RSC, and pre-1.0
  or niche dependencies require a separate dated decision in the frontend guide.
- Frontend state starts in its narrowest owner (`useState`/`useReducer`, then a
  feature hook, then lifted state or a feature context) and is derived during
  render. Effects only synchronize with external systems. Do not introduce
  Redux, Zustand, or another state library without demonstrated coordination
  or workflow complexity.

## Build, Test, and Development Commands

Use Node.js 22.x LTS, pnpm 10, and Docker. Prefer pnpm-prefixed Nx commands over invoking underlying tools directly.

- Before Node, pnpm, or Nx commands, load NVM when needed with `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"` and run `nvm use` to activate `.nvmrc`.
- If pnpm is unavailable after installing a new NVM Node version, run `corepack enable`; Corepack will use the pnpm version pinned in `packageManager`.
- In sandboxes or containers that prohibit Unix sockets, prefix Nx commands with `NX_DAEMON=false`.
- `pnpm install`: install workspace dependencies.
- `pnpm db:up`: start PostgreSQL, Keycloak, and Floci with their existing
  local state (Floci reprovisions its in-memory resources on every start).
- `pnpm db:down`: stop and remove the containers while preserving local data.
- `pnpm db:setup`: delete local PostgreSQL and Keycloak state, recreate the
  services, apply Prisma migrations, and import the development realm.
- `pnpm start`: start PostgreSQL, Keycloak, and Floci, then serve the API and
  web applications in parallel.
- `pnpm db:migrate`: create/apply local Prisma migrations after schema changes.
- `pnpm start:api`: serve the API in development mode.
- `pnpm build:api`: build the API into `dist/`.
- `pnpm test`: run all project tests (Jest for backend, Vitest for frontend).
- `pnpm check`: lint, test, typecheck, and build all Nx projects.
- `pnpm db:generate`: regenerate the Prisma client.

Check `pnpm nx <command> --help` before using unfamiliar flags. For scaffolding, use Nx generators and preserve existing project tags.

## Coding Conventions

TypeScript uses Prettier with single quotes and the Nx flat ESLint configuration.
Use kebab-case filenames, PascalCase classes, and camelCase methods and
variables. Prefix every enum name with `E` (`ETitleType`, `EAppErrorCode`).
Prefer guard clauses. Use `unknown` for untrusted input and narrow it
explicitly; use precise types for internal domain inputs. Do not use `any`
unless unavoidable framework typing requires it.

Do not put small functions in dedicated files to share them between services,
use cases, handlers, or components. Behavior lives with its owner: a private
method or a local function in the file that uses it, a method or static on the
aggregate, value object, or domain service that owns the rule, or a method on a
port when several services need the same capability (create a port when none
fits). One-line logic stays inline at each call site, and `Result` helpers such
as `valueOrNull` cover optional lookups. A standalone shared function file is
acceptable only for a true utility: it computes no business rule, is domain
agnostic, and receives no port or other application dependency, such as
`libs/investment-simulator/web/src/lib/decimals/format-decimal.ts`.

Model for understanding, following DDD. Before changing a domain shape, map
the PRD's terms to named types, group data by the business question it
answers, and derive any fact that follows from other state instead of storing
it twice. When extending an existing type would leave it unclear, remodel it
in the same change rather than appending fields. Plans that touch the domain
state the model first: the types, the vocabulary they encode, and what is
stored versus derived. See "Model review" in
`$investflow-domain-application`.

`AppError` messages are user-facing, concise pt-BR that clients show as is.
The stable `code` is the contract for behavior and tests. Every code is a member
of the single `EAppErrorCode` enum in `@investflow/shared-domain`. 5xx responses
replace the message with a generic one.

Value-object immutability relies on readonly state and controlled domain behavior.
Do not add `Object.freeze` calls or tests that bypass TypeScript solely to verify
runtime freezing.

Domain factories must accept precise domain input types, including validated
value objects, enums, and constrained literal unions. Do not widen them to `unknown`, add redundant `instanceof` checks,
or return `Result` merely to check their TypeScript type or enum/union membership. Return the constructed
object directly when no additional business invariant can fail. Use `Result` only
for meaningful validation or business failures, and keep raw-input validation at
the boundary or in the value object that owns that validation. Keep changes
scoped.

Comment only what the code cannot say: a non-obvious constraint, side effect,
workaround, ordering or format guarantee, or why an apparently simpler option
is wrong. Do not write comments that restate a name or signature, summarize what
a function, component, hook, type, or field does, give example outputs of a
formatter, label a section, or cite decisions and dates. Doc comments
(`/** */`) follow the same rule; most declarations need none.

The workspace intentionally retains `baseUrl` because the Nx TypeScript executor requires it for workspace path aliases. Use the workspace TypeScript version configured in `.vscode/settings.json`; do not add `ignoreDeprecations`.

## Testing Guidelines

Backend projects use Jest; frontend projects use Vitest through Nx.
Place focused unit tests in a `test/` folder beside the source files they cover, using `*.spec.ts` (`*.spec.tsx` when a test needs JSX); fixtures used only by those tests live there too. When a folder would hold a single file, keep that file beside the source instead. Cover domain invariants, state transitions, error paths, and event emission. Run one project with `pnpm nx run <project>:test`; run the full suite with `pnpm test`.

Do not add request-DTO unit suites that merely repeat built-in
`class-validator` behavior. Test custom validators and decorators directly
and command request-mapping in command tests. Do not write controller specs:
controllers only delegate to use cases and query handlers, so add one only when
a controller has its own behavior that no other test covers.

Frontend tests follow the state-first policy in `$investflow-react`: test
feature hooks (with `renderHook`), API adapters, and pure helpers without
asserting DOM structure or UI details.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, primarily `feat: ...` and `fix: ...`. Keep commits scoped and imperative. Pull requests should explain behavior changes, identify affected contexts, link relevant issues, and include validation commands. Add request/response examples for API changes and call out schema migrations or configuration changes explicitly.

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
