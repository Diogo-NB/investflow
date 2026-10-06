---
name: investflow-angular
description: Implement, review, or refactor the Angular frontend in the InvestFlow Nx workspace. Use for Angular routes, pages, components, forms, browser API clients, UI state, Material or Tailwind styling, frontend tests, or decisions about splitting web libraries. Do not use for backend-only NestJS work.
---

# InvestFlow Angular

Keep the frontend small enough to understand in one sitting while preserving
the boundaries that make it safe to grow.

## Start with the repository

Inspect `apps/web`, the affected `libs/<context>/web` project, `DESIGN.md`, the
relevant `project.json` files, and the root ESLint boundary rules before making
changes. Preserve the installed Angular, Nx, TypeScript, Material, and Vitest
versions unless the task is an explicit upgrade.

Repository conventions take precedence over generic Angular skills. Use Nx
generators within this workspace, not a separate `ng new` workspace or a global
CLI installation. Keep Node and package versions unless an upgrade is approved.
The app owns the welcome page, shell, and Keycloak integration. Offer CRUD lives
in the lazy-loaded `libs/investment-simulator/web` project. Do not restore the
removed connectivity feature as scaffolding.

When the task changes frontend project structure, authentication, state management,
data fetching, forms, or dependency choices, read
`docs/architecture/frontend-patterns.md` before editing.

## Default architecture

- Keep `apps/web` as a thin composition root. It owns bootstrap, application
  providers, the outer shell, and top-level routes. It does not own business
  features.
- Put each bounded context's browser presentation in one lazy-loaded
  `libs/<context>/web` project.
- Organize each context web project feature-first: context composition under
  `routes`, plural feature roots such as `offers`, then `feature`, `api`,
  `models`, and optional `ui` or `utils` within each feature.
- Export only true composition contracts from `src/index.ts`, normally the
  context route definition. Do not expose internal components, services, or
  transport types for convenience.
- Import only through workspace aliases across projects. Use relative imports
  inside a project.
- Keep browser projects independent of server projects. Define browser response
  types locally and treat the HTTP contract as the boundary.

InvestFlow has a single frontend app. Keep browser types, components, state,
and utilities inside `apps/web` or the owning context web project. Reuse local
code through folders and relative imports; do not extract reusable frontend Nx
libraries for features, data access, UI, state, types, or utilities. Existing
context web projects organize this app's features and expose route composition,
not reusable frontend packages. Changing this rule requires an explicit
architecture decision from the user.

Keep `PaginatedResult<Item>` internal to
`libs/investment-simulator/web/src/lib/pagination/paginated-result.type.ts`.
Browser API adapters import it relatively. The backend defines its own generic
pagination contract in `@investflow/shared-types`; do not cross-import it.

## Angular defaults

- Use standalone components, zoneless change detection, strict template
  checking, `ChangeDetectionStrategy.OnPush`, and `inject()`. Standalone is the
  Angular 21 default; do not add `standalone: true`, feature NgModules, or broad
  `CommonModule` imports.
- Use `input()` and `output()` for new component APIs, signal queries such as
  `viewChild()` and `contentChild()`, and `model()` only when the component
  genuinely owns a two-way editing contract. Keep data flowing down and user
  intent flowing up.
- Prefer native Angular signals for UI state. Use `signal()` for mutable
  component or feature state and `computed()` for derived state. A
  feature-scoped state service remains signal-first: keep its writable signals
  private and expose read-only signals to consumers. Use `linkedSignal()` only
  for state that is both derived and intentionally writable. Update signal
  values immutably with `set()` or `update()`. Model mutually exclusive async
  states with a discriminated union rather than several booleans.
- Keep RxJS at asynchronous boundaries such as `HttpClient`, router streams, or
  multi-event workflows. Convert or subscribe once near the owning feature. Use
  `AsyncPipe`, `toSignal()`, or `takeUntilDestroyed()` rather than manual
  subscription bookkeeping.
- Use `effect()` only to synchronize with something outside Angular state. Do
  not use effects to copy or propagate state.
- Use Angular's native template control flow. Include an explicit `track`
  expression in `@for` blocks. Keep expressions cheap and move non-trivial
  derivation to `computed()` values or pure functions. Prefer direct `class`
  and `style` bindings over `NgClass` and `NgStyle`.
- Put host bindings and listeners in the component or directive `host` object,
  not `@HostBinding` or `@HostListener` decorators.
- Signal Forms, `resource()`, and `httpResource()` are explicitly approved
  experimental Angular 21 APIs. Prefer Signal Forms for new forms and
  `httpResource()` for reactive reads; use HttpClient/RxJS for commands and
  asynchronous workflows. Read the architecture guide's adoption decision for
  lifecycle, fallback, and migration risks. Do not describe these APIs as stable
  or add demonstration forms/requests without a product need.
- Use `@defer` only for heavy, non-critical content where deferred loading
  improves the initial route. Do not defer primary above-the-fold content.
- Use `NgOptimizedImage` for non-decorative static images, with intrinsic
  dimensions and appropriate priority for the likely LCP image.

## Components and data access

- Let a route page coordinate loading, local state, and user actions.
- Lazy-load bounded-context routes. Prefer functional guards, resolvers,
  interceptors, and provider APIs; introduce classes only when framework
  integration or meaningful reusable state requires an instance.
- Extract a presentational component when it is reused, independently complex,
  or substantially improves the page's readability. Do not split markup merely
  to satisfy a size target.
- Keep API services thin: relative `/api` URLs, typed request and response
  values, and no presentation state.
- Preserve decimal-string precision for financial input and HTTP values. Calendar
  strings must not become local-time instants. Initialize an editor from a single
  server snapshot and preserve dirty input through failures.
- Normalize an error only when the UI can make a meaningful distinction. Never
  display raw server or transport errors to the user.
- Provide explicit loading, empty, success, and failure states when each state
  is possible. Ensure retry actions cannot accidentally create overlapping
  requests.

## Authentication

- Keep Keycloak configuration and UI session state in the app; features remain
  unaware of the identity provider. Tokens stay in memory and the bearer
  interceptor matches only relative `/api` paths.
- Preserve the explicit initializer that rejects failed or unauthenticated
  initialization. The installed library's automatic initializer catches errors,
  so switching to it can expose the shell without authentication.
- Start activity/refresh tracking only after initialization succeeds. The
  existing 30-minute inactivity policy is evaluated on token expiry, not by a
  separate wall-clock timer. Keep the safe bootstrap fallback and logout retry.

## UI and accessibility

- Reuse Angular Material for interaction primitives and use the tokens in
  `DESIGN.md` for product identity. Tailwind CSS v4 projects those tokens into
  semantic utilities from `apps/web/src/styles.css`; do not use its default
  palette or arbitrary feature colors and radii.
- Keep the global reset, font faces, Tailwind configuration, and design tokens in
  `apps/web/src/styles.css`. Material's Sass API uses the documented global
  exception `apps/web/src/material-theme.scss`, loaded after the CSS tokens;
  it projects those tokens into Material controls. Use semantic utilities in templates and host
  metadata. Add a component stylesheet only when Tailwind cannot clearly
  express a third-party integration or complex stateful selector, and document
  that exception.
- Avoid wrapper components that only rename a Material component.
- Preserve semantic HTML, visible keyboard focus, accessible names, target
  sizes, live-region behavior for async updates, and reduced-motion behavior.
- Keep Portuguese product copy consistent with the surrounding screen.

## Tests

- Use Angular-native Vitest through Nx.
- Put most frontend test effort into feature stores and state services. Cover
  loading, success, empty, failure, retry, and request coordination when those
  states exist.
- Keep components thin and test only class-level state exposure or intent
  delegation. Instantiate them in an injection context without compiling or
  rendering templates.
- Do not query DOM nodes or assert HTML structure, CSS classes, snapshots, or
  static copy in frontend unit tests.
- Retain focused non-UI contract tests for API adapters, authentication,
  routing, and bootstrap when they protect meaningful boundary behavior.
- Test pure helpers without Angular's test environment and avoid tests of
  private methods or framework implementation details.

Run the affected frontend lint, test, and production build targets. Run
`pnpm check` when the change can affect workspace boundaries or shared
configuration. Use targeted API build or prune checks when dependency changes
could leak browser packages into the server artifact.

## Guardrails

Do not replace a native signal-backed service with NgRx SignalStore merely for
API style or consistency. Add NgRx or another state library only when observed
requirements such as cross-feature coordination, normalized client entities,
undo/redo, or a comparably complex workflow justify it. Do not add SSR,
hydration, service workers, micro-frontends, OpenAPI generation, a design-system
library, or an end-to-end test project unless the task supplies a concrete need
for it. Document a new frontend-wide pattern when one is intentionally
introduced.
