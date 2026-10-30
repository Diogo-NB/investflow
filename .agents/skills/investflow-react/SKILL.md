---
name: investflow-react
description: Implement, review, or refactor the React + Vite frontend in the InvestFlow Nx workspace, including the simulation, offer, and curve screens. Use for routes, pages, components, hooks, forms, browser API clients, TanStack Query, UI state, Base UI or Tailwind styling, Keycloak in the browser, accessibility, frontend tests, or screen design, and whenever a change edits files under apps/web or libs/*/web. Do not use for backend-only NestJS work.
---

# InvestFlow React

Keep the frontend small enough to understand in one sitting while preserving
the boundaries that make it safe to grow.

## Start

- Read the behavior file of the screen you change in `docs/product/screens/`
  (`simulations.md`, `offers.md`, `curves.md`, `investment-plans.md`,
  `app-shell.md`; pt-BR, what the user sees) and "Screen mechanics" in
  `docs/architecture/frontend-patterns.md` (how the screens do it). Build
  from that recorded behavior as idiomatic React; never transliterate an
  earlier implementation's structure.
- Read `docs/architecture/frontend-patterns.md` when adding a dependency
  ("Stack and versions"), a project or folder ("App and ownership"), a route
  or context export ("Composition contract"), or a business rule in a form
  ("Business rules and the business calendar").
- Read `references/authentication.md` before changing Keycloak startup,
  token refresh, `authorizedFetch`, identity, inactivity, or logout.
- Read `DESIGN.md` before new or restyled UI.
- Inspect `apps/web`, the affected `libs/<context>/web` project, and nearby
  hooks and tests. Scaffold with the installed Nx generators (`@nx/react`,
  `bundler: vite`, `unitTestRunner: vitest`, no style files). Keep Node,
  TypeScript, Nx, and lockfile versions unless an upgrade is approved.

## Stability and vendored skills

Use stable, documented React and widely adopted libraries only: no canary or
experimental React, `unstable_*` or `experimental_*` APIs, Server
Components, React Router Framework or RSC modes, or pre-1.0 and niche
packages without a dated decision in the frontend guide. Add a package with
its first consumer, and never a library a vendored skill suggests without
that decision.

Load `react-router` for routing work (this app uses **Data mode**: read only
its `references/data-mode.md` and `node_modules/react-router/docs`) and
`vercel-composition-patterns` for component API design. This skill takes
precedence: this is a client-only SPA, so ignore server, RSC, hydration,
Next.js, loader, action, and fetcher guidance.

## Architecture

- `apps/web` is a thin composition root: bootstrap, Keycloak, providers
  (`QueryClient`, router), the shell, the welcome page, and top-level
  routes. No business features.
- Each bounded context's screens live in one lazy-loaded, non-buildable
  `libs/<context>/web` library, organized feature-first: `routes`, then
  plural features (`offers`) with `feature`, `api`, `models`, and optional
  `ui` or `utils`.
- `src/index.ts` exports only the composition contract, a route factory such
  as `investmentSimulatorRoutes({ fetch })`, plus the sections and prefetch
  the app renders. The library keeps `deps` in an internal context; features
  never import Keycloak or app modules and use relative `/api` URLs.
- Relative imports inside a project, workspace aliases between projects.
  Browser projects define their own transport types and never import server
  code. Never extract reusable frontend Nx libraries; that needs an explicit
  architecture decision. `PaginatedResult<Item>` stays internal to
  `libs/investment-simulator/web/src/lib/pagination/`.

## Components and state

- Function components with named exports, kebab-case files
  (`offer-list.tsx`, `use-offer-list.ts`). Follow the Rules of React and keep
  `eslint-plugin-react-hooks` clean, without suppressions. `StrictMode` in
  development.
- React 19: pass `ref` as a prop and render `<Context value>`; no
  `forwardRef`, class components, legacy context, or `defaultProps`.
- Props flow down and callbacks up. Prefer children and compound or explicit
  variant components over boolean mode props. Never define components inside
  components; hoist static data and JSX out of render.
- No `useMemo`, `useCallback`, or `memo` by default; add one for a measured
  cost or a required stable identity (effect dependency, context value,
  third-party API).
- State starts in its narrowest owner: `useState` (`useReducer` when
  transitions are interdependent), then a feature hook that orchestrates a
  page (`use-offer-editor.ts`), then lifted state, then a feature context.
  Derive during render. Model exclusive async states as a discriminated
  union, not loading/data/error booleans. Update immutably.
- `useEffect` only synchronizes with external systems (subscriptions, the
  DOM, `beforeunload`, focus). Never use it to copy, derive, or reset state,
  to fetch, or to react to user events; use the event handler or a `key`.
- No Redux, Zustand, Jotai, or similar without demonstrated cross-feature
  coordination, normalized client entities, undo/redo, or comparable
  workflow complexity.

## Data and routing

- One `QueryClient` in the app. **Reads:** `useQuery` with the query
  `signal` passed to `fetch`, and a key factory per feature in `api/`
  (`offerKeys.list(filters)`). `placeholderData: keepPreviousData` only where
  showing the previous page is intended. Retry with `refetch`.
- **Writes:** `useMutation` with `retry: 0`, since a lost response may hide a
  committed write. Disable repeat submission while pending; after success,
  invalidate keys and navigate. Create and edit are separate mutations, not
  one that branches on `id === undefined`.
- API adapters are small and typed. Show the API's pt-BR
  `ApiError.userMessage`; keep no copy per error code, and use `code` and
  `details` only for behavior (which field to focus, how to recover).
  Network and bodiless failures get a local generic message; never render
  raw transport or provider errors.
- Screens read screen-oriented queries; the browser formats and arranges
  what it receives and never re-derives business facts.
- Money and rates cross the boundary as decimal strings: preserve precision,
  round only for display, never `Number` for financial rates. Calendar
  strings (`YYYY-MM-DD`) never become local-time instants; local `Date`
  objects stay inside the date-picker widget.
- Routes use Data mode (`createBrowserRouter`, `<RouterProvider>`), `lazy`
  per context, and `ErrorBoundary` for unexpected failures. Expected states
  (loading, empty, missing, retryable failure) render inside the page, and
  retries can't overlap.
- URL search parameters are state: parse and validate them, preserve
  unrelated ones, and correct stale values by navigating with `replace`, not
  with an effect.

## Forms

- React Hook Form with a Zod schema per form through `zodResolver`. Base UI
  controls connect through `Controller`, native inputs through `register`.
- Initialize an editor once from one server snapshot via `defaultValues`;
  never reset it from a later read while the user has unsaved input.
- Validation shows after touch or submit; submit focuses the first invalid
  field. Pending submits lock the form, and failures keep the input so a
  retry resends it.
- Unsaved changes: `useBlocker` for in-app navigation and `beforeunload` for
  document exits, active only while dirty and not submitting.
- The API has the final say on business rules. A form repeats a small rule
  set only for instant feedback, with the API's messages; editing
  conveniences that are not rules live in pure, tested frontend functions.

## Designing screens

Good UX here means easy, fast, reliable, and clear for someone managing many
simulations, offers, and curves, not decoration.

- Design from the user's task and what they need to decide. For a new screen
  or a major redesign, present at least two layouts with a recommendation
  before building.
- Keep copy short and direct. Explain business rules (taxes, missing curve
  values) with the fact and the reason, not legal references or long text,
  and show detail on demand (dialog, expandable row).
- Make errors actionable: say what is missing and link to where it is fixed.
- Use each aggregate's canonical icon everywhere it appears, and subtle
  motion for state changes such as recalculating, respecting reduced motion.
- Look for edge cases before presenting: empty and long lists, invalid and
  boundary dates, removing an item in the middle, undo, narrow viewports.

## Styling and accessibility

- `DESIGN.md` is the visual source of truth; `apps/web/src/styles.css` owns
  the reset, fonts, tokens, and Tailwind configuration, including an
  `@source` for each context web library. Use the semantic Tailwind v4
  utilities it projects; never the default palette, arbitrary colors or
  radii, CSS-in-JS, CSS modules, or component stylesheets without a
  documented exception (the one today: `react-day-picker/style.css`, themed
  through `--rdp-*`).
- Base UI supplies interaction primitives (Dialog, AlertDialog, Select,
  Field, Popover, Menu). Don't wrap a primitive only to rename it; a local
  `ui/` component must add behavior or replace repeated markup.
- Write canonical Tailwind classes (`aria-current:`, `max-h-128`,
  `-translate-1/2`, `text-xl/tight`); lint enforces it. Repeat the line height
  on responsive sizes (`text-xl/tight sm:text-2xl/tight`).
- Charts use Recharts with design tokens as props, animation off, and a
  table or text with the exact values beside them.
- Keep Portuguese copy, semantic landmarks, a skip link, visible focus,
  readable contrast, keyboard-operable actions, 44px targets, live regions for
  async updates, route focus on the main landmark, and reduced motion. Color
  never communicates state alone. Light theme only, IBM Plex Sans hosted
  locally, no remote fonts, stock imagery, or icon font.

## Before finishing

- Every async state the screen can reach (loading, empty, failure, retry,
  pending write) renders, and none can overlap.
- No effect copies or derives state, and no write retries automatically.
- Decimal strings and calendar strings never pass through `Number` or
  `Date`.
- Copy is short and every error says how to fix it.
- The screen works at 390px.
- Look at the final screenshots as a user would. Destructive styling (error
  color, trash or ✕ in red) only for actions that destroy something; row
  actions in their own column or menu, never stacked inside a data cell; no
  placement chosen to dodge an existing layout bug, which gets fixed instead.

## Tests

Vitest through Nx with jsdom, state-first:

- Most effort goes into feature hooks tested with `renderHook`, a fresh
  `QueryClient` (`retry: false`), and the library's deps context with a fake
  `fetch`: loading, success, empty, failure, retry, cancellation, and
  duplicate-write prevention.
- Test pure helpers without React, plus API adapters, the authentication
  boundary, and route definitions.
- Never query DOM nodes or assert markup, CSS classes, snapshots, or static
  copy.

Finish with the checks for frontend in "Done means" in `AGENTS.md`.

## Guardrails

Don't add SSR, RSC, React Router Framework mode, service workers,
micro-frontends, OpenAPI generation, a global state library, a design-system
library, or an end-to-end test project without a concrete need. When you
introduce a frontend-wide pattern on purpose, record it in the frontend
guide.
