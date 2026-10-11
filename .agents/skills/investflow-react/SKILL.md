---
name: investflow-react
description: Implement, review, or refactor the React + Vite frontend in the InvestFlow Nx workspace, including the simulation, offer, and curve screens. Use for routes, pages, components, hooks, forms, browser API clients, TanStack Query, UI state, Base UI or Tailwind styling, Keycloak in the browser, frontend tests, or decisions about splitting web libraries. Do not use for backend-only NestJS work.
---

# InvestFlow React

Keep the frontend small enough to understand in one sitting while preserving
the boundaries that make it safe to grow.

## Start with the repository

Read `docs/architecture/frontend-patterns.md` before any frontend change. It
records the decision, the pinned stack, the status sequence, and the recorded
app-shell, simulation workspace, offer, and curve behavior. Then inspect `apps/web`, the affected
`libs/<context>/web` project, `DESIGN.md`, the relevant `project.json` files,
and the root ESLint boundary rules.

When rebuilding a feature, start from its recorded behavior and design it as
idiomatic React: hooks, local state, and composition. Don't transliterate an
earlier implementation's structure. Follow the guide's sequence. Use the installed Nx
generators (`@nx/react`, `bundler: vite`, `unitTestRunner: vitest`), not a
separate Vite workspace or a global CLI. Keep Node, TypeScript, Nx, and
lockfile versions unless an upgrade is approved.

## Stability policy

Use modern, mainstream React: stable, documented APIs and widely adopted
libraries only. Don't use canary or experimental React, `unstable_*` or
`experimental_*` APIs, React Server Components, React Router Framework or RSC
modes, or pre-1.0 and niche packages. Proposing one requires a separate dated
decision in the frontend guide. React Compiler is deferred until its Vite
integration is stable.

## Skills and precedence

Load these vendored skills alongside this one when the task matches:

- `$react-router` for routing work. This app uses **Data mode**, so read only
  `references/data-mode.md` and the installed `node_modules/react-router/docs`.
- `$vercel-composition-patterns` for component API design: compound
  components, explicit variants, no boolean-prop sprawl.
- `$vercel-react-best-practices` for performance work and reviews.

This skill and the frontend guide take precedence over them:

- This is a client-only SPA. Ignore `server-*`, RSC, hydration, Next.js
  (`next/dynamic`, `after()`), and SWR rules. Use route `lazy` or
  `React.lazy` for code splitting and TanStack Query for client data.
- React Router's loaders, actions, `<Form method="post">`, and fetchers aren't
  used for data. TanStack Query owns reads and writes, React Hook Form owns
  forms, and routes use `lazy`, `ErrorBoundary`, `useSearchParams`, and
  `useBlocker`.
- Don't add libraries a rule suggests (for example `better-all` or SWR) without
  a decision in the frontend guide.
- The barrel-import rule applies inside projects. Each project's `src/index.ts`
  is its only, intentional public API.

## Default architecture

- `apps/web` is a thin `@nx/react` Vite composition root. It owns bootstrap,
  Keycloak, providers (`QueryClient`, router), the outer shell, the welcome
  page, and top-level routes. It doesn't own business features.
- Each bounded context's browser presentation lives in one lazy-loaded,
  non-buildable `libs/<context>/web` library bundled by the app.
- Organize each context web project feature-first: context composition under
  `routes`, plural feature roots such as `offers`, then `feature`, `api`,
  `models`, and optional `ui` or `utils` within each feature.
- Export only the composition contract, a route factory such as
  `investmentSimulatorRoutes({ fetch })`, from `src/index.ts`. The app injects
  its authorized fetch, and the library keeps it in an internal context.
- Import through workspace aliases across projects and relative paths inside a
  project. Keep browser projects independent of server projects. Define
  browser transport types locally.

InvestFlow has a single frontend app. Don't extract reusable frontend Nx
libraries for features, data access, UI, hooks, state, types, or utilities.
Changing this rule requires an explicit architecture decision from the user.
Keep `PaginatedResult<Item>` internal to
`libs/investment-simulator/web/src/lib/pagination/paginated-result.type.ts`.

## React defaults

- Function components with named exports. Use kebab-case files (`offer-list.tsx`,
  `use-offer-list.ts`). Follow the Rules of React and keep
  `eslint-plugin-react-hooks` clean.
- React 19: pass `ref` as a prop and render `<Context value>`. Don't use
  `forwardRef`, class components, or `defaultProps`.
- Props flow down and callbacks flow up. Prefer children and compound or
  explicit variant components over boolean mode props.
- Don't add `useMemo`, `useCallback`, or `memo` by default. Use them for a
  measured cost or a required stable identity (effect dependency, context
  value, third-party API).
- Put state in its narrowest owner: `useState` or `useReducer`, then a feature
  hook for page orchestration, then lifted state or a feature context. Derive
  during render. Model exclusive async states as a discriminated union. Update
  immutably.
- `useEffect` is only for syncing with external systems. Never use it to copy,
  derive, or reset state, to fetch data, or to react to user events. Use event
  handlers and `key` instead.
- Don't add Redux, Zustand, Jotai, or similar without demonstrated
  coordination or workflow complexity.

## Data, routing, and forms

- **Reads:** `useQuery` with the query `signal` passed to `fetch` and
  per-feature key factories in `api/`. Retry with `refetch`.
- **Writes:** `useMutation` with `retry: 0`. Disable repeat submission while
  pending. After success, invalidate keys and navigate. Never auto-retry a
  write.
- URL search parameters are state. Validate them, preserve unrelated ones, and
  correct stale values by navigating with `replace`, not with an effect.
- **Forms:** React Hook Form + Zod via `zodResolver`. Initialize once from one
  server snapshot. Focus the first invalid field. Lock while pending and keep
  input on failure. `useBlocker` + `beforeunload` guard unsaved changes.
  Base UI controls connect through `Controller`.
- Preserve decimal-string precision for financial values. Calendar strings
  must not become local-time instants. Never display raw server or transport
  errors.
- Provide explicit loading, empty, success, and failure states, and make sure
  retries can't overlap.

## Authentication

- `keycloak-js` is used directly, and only in the app. `main.tsx` awaits
  `keycloak.init()` (PKCE S256, `login-required`) before rendering. A failure or
  unauthenticated result shows the safe Portuguese fallback with a reload
  action outside React.
- Tokens stay in memory. `authorizedFetch` attaches the bearer only to `/api`
  and `/api/...` after `updateToken`.
- Refresh tracking starts after successful init. The 30-minute inactivity
  policy is evaluated on token expiry. Identity comes through
  `useSyncExternalStore` over Keycloak events. Keep logout retry and the
  duplicate-intent guard.

## UI and accessibility

- Base UI supplies interaction primitives (Dialog, AlertDialog, Select, Field,
  Popover). Style them with the semantic Tailwind v4 utilities that
  `apps/web/src/styles.css` projects from `DESIGN.md` tokens. Don't use the
  default palette, arbitrary colors or radii, CSS-in-JS, CSS modules, or
  component stylesheets without a documented exception.
- Don't create wrappers that only rename a primitive.
- Preserve semantic HTML, visible keyboard focus, accessible names, 44px
  targets, live regions for async updates, route focus on the main landmark,
  and reduced motion. Keep Portuguese product copy.

## Tests

- Vitest through Nx with jsdom. Put most effort into feature hooks tested with
  `renderHook`, a fresh `QueryClient` (`retry: false`), and a fake `fetch`.
  Cover loading, success, empty, failure, retry, cancellation, and
  duplicate-write prevention.
- Test pure helpers without React. Keep focused tests for API adapters, the
  auth boundary, and route definitions.
- Don't query DOM nodes or assert markup, CSS classes, snapshots, or static
  copy in unit tests.

Run the affected frontend lint, test, and production build targets. Run
`pnpm check` when a change can affect workspace boundaries or shared
configuration, and `pnpm nx run api:prune` when dependency changes could leak
browser packages into the server artifact.

## Guardrails

Don't add SSR, RSC, React Router Framework mode, service workers,
micro-frontends, OpenAPI generation, a global state library, a design-system
library, or an end-to-end test project unless the task supplies a concrete need
for it. When you introduce a new frontend-wide pattern on purpose, document it
in the frontend guide.
