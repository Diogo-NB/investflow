# Repository Guidelines

## Project Overview

InvestFlow is a NestJS 11 modular monolith managed with Nx and pnpm. Deployable
hosts live under `apps/`. Business capabilities live under `libs/<context>/`
and are split into `domain`, `application`, and `infrastructure` Nx projects;
browser presentation uses an optional `web` project. Cross-context building
blocks belong in `libs/shared`. Infrastructure and identity setup live under
`infra/`.

## Codex Skills

Load the repository skill that matches the work:

- `$investflow-domain-application` for aggregates, value objects, domain
  services, use cases, ports, application errors, and temporal behavior.
- `$investflow-nestjs-infrastructure` for controllers, DTOs, Prisma adapters,
  query handlers, Nest modules, dependency injection, and host composition.
- `$investflow-eventing` for domain events, the transactional outbox, SNS/SQS,
  consumers, retries, and idempotency.
- `$investflow-angular` for routes, components, forms, browser API clients,
  state, styling, accessibility, and frontend tests.

Cross-layer changes can require more than one skill.

## Architecture Invariants

- Apps are thin composition roots; business behavior stays in its bounded
  context.
- Domain code is framework-free and cannot depend on application or
  infrastructure code.
- Bounded contexts communicate through integration events or explicit
  contracts, never by importing one another's internals.
- Shared libraries cannot depend on feature contexts.
- Export every library's public API through `src/index.ts`; use workspace
  aliases across projects and relative imports within a project.
- Domain and application code use `CalendarDate`, `CalendarDateRange`, and
  `UtcInstant` from `@investflow/shared-domain`, and obtain time through the
  shared `Clock` port. Native `Date` is restricted to infrastructure boundaries
  and must be converted immediately.
- Frontend state is signal-first: use native Angular `signal()` for mutable UI
  state and `computed()` for derived state, including inside feature-scoped
  state services. Keep RxJS at asynchronous boundaries. Do not introduce NgRx
  SignalStore or another state library without demonstrated coordination or
  workflow complexity that native signals do not handle clearly.
- Frontend code defaults to stable, framework-native Angular APIs: standalone
  components, zoneless change detection, `OnPush`, `inject()`, signal component
  APIs, native template control flow, lazy feature routes, functional providers,
  and typed reactive forms. Experimental Angular APIs require an explicit
  adoption decision documented in `$investflow-angular` and the frontend
  architecture guide.

## Build, Test, and Development Commands

Use Node.js 22.x LTS, pnpm 10, and Docker. Prefer pnpm-prefixed Nx commands over invoking underlying tools directly.

- Before Node, pnpm, or Nx commands, load NVM when needed with `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"` and run `nvm use` to activate `.nvmrc`.
- If pnpm is unavailable after installing a new NVM Node version, run `corepack enable`; Corepack will use the pnpm version pinned in `packageManager`.
- In sandboxes or containers that prohibit Unix sockets, prefix Nx commands with `NX_DAEMON=false`.
- `pnpm install`: install workspace dependencies.
- `pnpm db:up`: start PostgreSQL and Keycloak with their existing local state.
- `pnpm db:down`: stop and remove both containers while preserving local data.
- `pnpm db:setup`: delete local PostgreSQL and Keycloak state, recreate both
  services, apply Prisma migrations, and import the development realm.
- `pnpm start`: start PostgreSQL and Keycloak, then serve the API and web
  applications in parallel.
- `pnpm db:migrate`: create/apply local Prisma migrations after schema changes.
- `pnpm start:api`: serve the API in development mode.
- `pnpm build:api`: build the API into `dist/`.
- `pnpm test`: run all Jest project tests.
- `pnpm check`: lint, test, and build all Nx projects.
- `pnpm db:generate`: regenerate the Prisma client.

Check `pnpm nx <command> --help` before using unfamiliar flags. For scaffolding, use Nx generators and preserve existing project tags.

## Coding Conventions

TypeScript uses Prettier with single quotes and the Nx flat ESLint configuration.
Use kebab-case filenames, PascalCase classes, and camelCase methods and
variables. Prefer guard clauses, accept `unknown` and narrow it explicitly, and
do not use `any` unless unavoidable framework typing requires it. Keep changes
scoped and comment only non-obvious constraints, side effects, or workarounds.

The workspace intentionally retains `baseUrl` because the Nx TypeScript executor requires it for workspace path aliases. Use the workspace TypeScript version configured in `.vscode/settings.json`; do not add `ignoreDeprecations`.

## Testing Guidelines

Jest is configured per Nx project. Place focused unit tests beside source files using `*.spec.ts`. Cover domain invariants, state transitions, error paths, and event emission. Run one project with `pnpm nx run <project>:test`; run the full suite with `pnpm test`.

Frontend tests follow the state-first policy in `$investflow-angular`: test
stores and component orchestration without rendering templates or asserting
HTML/UI details.

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
