# Repository Guidelines

## Project Structure & Module Organization

InvestFlow is a NestJS 11 modular monolith managed with Nx and pnpm. The deployable API lives in `apps/api/src`. Bounded contexts live under `libs/investments` and `libs/portfolio`, each split into `domain`, `application`, and `infrastructure` libraries. Cross-context code belongs in `libs/shared`. Prisma configuration and migrations are in `libs/shared/infrastructure/prisma`; Docker and Keycloak setup are in `infra/`. Architecture and domain decisions are documented in `docs/`.

Respect the dependency boundaries enforced by ESLint tags: domain code must not depend on application or infrastructure code, bounded contexts must communicate through events, and shared libraries must not depend on feature contexts. Export public APIs through each library's `src/index.ts`.

## Build, Test, and Development Commands

Use Node.js 22.x LTS, pnpm 10, and Docker. Prefer pnpm-prefixed Nx commands over invoking underlying tools directly.

- Before Node, pnpm, or Nx commands, load NVM when needed with `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"` and run `nvm use` to activate `.nvmrc`.
- If pnpm is unavailable after installing a new NVM Node version, run `corepack enable`; Corepack will use the pnpm version pinned in `packageManager`.
- In sandboxes or containers that prohibit Unix sockets, prefix Nx commands with `NX_DAEMON=false`.
- `pnpm install`: install workspace dependencies.
- `pnpm db:up && pnpm kc:up`: start PostgreSQL and Keycloak.
- `pnpm db:migrate`: apply local Prisma migrations.
- `pnpm start:api`: serve the API in development mode.
- `pnpm build:api`: build the API into `dist/`.
- `pnpm test`: run all Jest project tests.
- `pnpm check`: lint, test, and build all Nx projects.
- `pnpm db:generate`: regenerate the Prisma client.

Check `pnpm nx <command> --help` before using unfamiliar flags. For scaffolding, use Nx generators and preserve existing project tags.

## Coding Style & Naming Conventions

TypeScript uses Prettier with single quotes and ESLint's Nx flat configuration. Run `pnpm nx affected -t lint` before submitting. Follow existing kebab-case filenames such as `create-product.use-case.ts`; use PascalCase for classes and camelCase for methods and variables. Keep domain behavior in aggregates/value objects, application orchestration in use cases, and external integrations in infrastructure.

The workspace intentionally retains `baseUrl` because the Nx TypeScript executor requires it for workspace path aliases. Use the workspace TypeScript version configured in `.vscode/settings.json`; do not add `ignoreDeprecations`.

## Testing Guidelines

Jest is configured per Nx project. Place focused unit tests beside source files using `*.spec.ts`. Cover domain invariants, state transitions, error paths, and event emission. Run one project with `pnpm nx run <project>:test`; run the full suite with `pnpm test`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, primarily `feat: ...` and `fix: ...`. Keep commits scoped and imperative. Pull requests should explain behavior changes, identify affected contexts, link relevant issues, and include validation commands. Add request/response examples for API changes and call out schema migrations or configuration changes explicitly.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

### Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

### When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
