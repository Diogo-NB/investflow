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

When the task changes frontend project structure, state management, data
fetching, forms, or dependency choices, read
`docs/architecture/frontend-patterns.md` before editing.

## Default architecture

- Keep `apps/web` as a thin composition root. It owns bootstrap, application
  providers, the outer shell, and top-level routes. It does not own business
  features.
- Put each bounded context's browser presentation in one lazy-loaded
  `libs/<context>/web` project.
- Organize that project internally with the folders it actually needs:
  `routes`, `feature`, `api`, `models`, and optionally `ui` or `utils`.
- Export only true composition contracts from `src/index.ts`, normally the
  context route definition. Do not expose internal components, services, or
  transport types for convenience.
- Import only through workspace aliases across projects. Use relative imports
  inside a project.
- Keep browser projects independent of server projects. Define browser response
  types locally and treat the HTTP contract as the boundary.

Do not create separate feature, data-access, UI, state, or utility Nx libraries
until a concrete extraction condition in the architecture guide is present.

## Angular defaults

- Use standalone components, zoneless change detection, strict template
  checking, `ChangeDetectionStrategy.OnPush`, and `inject()`.
- Use signal inputs and outputs for new component APIs where they fit. Keep data
  flowing down and user intent flowing up.
- Use `signal()` for mutable component or feature state and `computed()` for
  derived state. Model mutually exclusive async states with a discriminated
  union rather than several booleans.
- Keep RxJS at asynchronous boundaries such as `HttpClient`, router streams, or
  multi-event workflows. Convert or subscribe once near the owning feature.
- Use `effect()` only to synchronize with something outside Angular state. Do
  not use effects to copy or propagate state.
- Use Angular's native template control flow. Keep expressions cheap and move
  non-trivial derivation to `computed()` values or pure functions.
- Use typed reactive forms for production forms. Signal Forms, `resource()`, and
  `httpResource()` are not baseline choices while they remain experimental.
- Use `@defer` only for heavy, non-critical content where deferred loading
  improves the initial route. Do not defer primary above-the-fold content.

## Components and data access

- Let a route page coordinate loading, local state, and user actions.
- Extract a presentational component when it is reused, independently complex,
  or substantially improves the page's readability. Do not split markup merely
  to satisfy a size target.
- Keep API services thin: relative `/api` URLs, typed request and response
  values, and no presentation state.
- Normalize an error only when the UI can make a meaningful distinction. Never
  display raw server or transport errors to the user.
- Provide explicit loading, empty, success, and failure states when each state
  is possible. Ensure retry actions cannot accidentally create overlapping
  requests.

## UI and accessibility

- Reuse Angular Material for interaction primitives and use the tokens in
  `DESIGN.md` for product identity. Tailwind CSS v4 projects those tokens into
  semantic utilities from `apps/web/src/styles.css`; do not use its default
  palette or arbitrary feature colors and radii.
- Keep the global reset, theme, Tailwind configuration, and design tokens in
  `apps/web/src/styles.css`. Use semantic utilities in templates and host
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

Do not add NgRx, another state library, SSR, hydration, service workers,
micro-frontends, OpenAPI generation, a design-system library, or an end-to-end
test project unless the task supplies a concrete need for it. Document a new
frontend-wide pattern when one is intentionally introduced.
