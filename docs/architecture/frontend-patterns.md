# Frontend Patterns

InvestFlow uses the smallest Angular architecture that keeps ownership,
contracts, testing, and future extraction clear. The default is deliberately
boring: a thin application shell and one browser library per bounded context.
New layers and libraries must solve an observed problem.

## Chosen baseline

```text
apps/web
  bootstrap, global providers, shell, top-level lazy routes

libs/<context>/web
  routes/    context route definitions
  feature/   route pages and use-case orchestration
  api/       HttpClient adapters
  models/    browser transport and display types
  ui/        optional presentational components
  utils/     optional browser-only pure helpers
```

This is a vertical slice by business context, not a horizontal repository-wide
split into components, services, and models. A context's page, API client, and
display types usually change together, so they start in one Nx project.

`apps/web` remains a composition root. It may configure providers, layout, and
routes, but business screens and their data access belong to the context web
library. Each context library exposes only what the app must compose, normally
its routes.

Application-wide authentication belongs in this composition root. The web app
configures the Keycloak public client, initializes it before routing, owns the
authenticated identity and logout controls in its outer shell, and applies the
bearer-token interceptor. Feature libraries remain unaware of Keycloak and use
relative API URLs.

## Modern Angular baseline

The frontend favors stable Angular 21 capabilities over legacy patterns and
third-party abstractions. As the application grows:

- keep components standalone and import only the directives, pipes, and
  components they use; do not add feature NgModules or broad `CommonModule`
  imports;
- stay zoneless and use `ChangeDetectionStrategy.OnPush`; do not add `zone.js`
  or depend on patched async APIs to refresh a view;
- use `inject()` and functional provider, interceptor, guard, and resolver APIs
  unless an instance has meaningful state or framework integration;
- use `input()`, `output()`, and signal queries for component contracts; reserve
  `model()` for a genuine two-way editing contract;
- keep host bindings and listeners in decorator `host` metadata instead of
  `@HostBinding` and `@HostListener`;
- use native template control flow with an explicit `track` expression for
  `@for`, and prefer direct class and style bindings over `NgClass` and
  `NgStyle`;
- lazy-load bounded-context routes and use `@defer` only for heavy,
  non-critical content within an already loaded route;
- use `NgOptimizedImage` for content images, declare intrinsic dimensions, and
  prioritize only the likely largest-contentful-paint image;
- use typed reactive forms until Signal Forms are deliberately adopted after
  reaching an acceptable stability level;
- dispose of observable work with `AsyncPipe`, `toSignal()`, or
  `takeUntilDestroyed()` instead of hand-written subscription collections.

Prefer stable APIs on the project's installed Angular major. Developer-preview
or experimental APIs are not forbidden, but their benefit, lifecycle impact,
fallback, and migration risk must be recorded here before they become a
frontend-wide default. In Angular 21 this includes Signal Forms, `resource()`,
and `httpResource()`; Angular Aria is developer preview, so prefer stable
Angular Material and CDK primitives for production interaction behavior.

## Component pattern

A route page is allowed to be a smart component. It coordinates a use case,
owns page-local state, calls a browser API service, and handles user actions.
This avoids a facade, store, and container/presenter pair for every small
screen.

Extract a presentational component when at least one condition is true:

- it is used in more than one place;
- it has independently meaningful interaction or accessibility behavior;
- it is complex enough to test and understand on its own;
- extraction makes the page materially easier to read.

Component APIs use signal inputs and outputs where appropriate. Data flows down
and user intent flows up. Components use standalone imports,
`ChangeDetectionStrategy.OnPush`, `inject()`, and Angular's native template
control flow.

## State pattern

The frontend is signal-first. Native Angular signals are the default for
synchronous UI state in components and feature-scoped state services:

- use `signal()` for mutable source state and expose `asReadonly()` outside its
  owner;
- use `computed()` for derived state instead of copying values between signals;
- use `linkedSignal()` only when state is derived from another signal but must
  also support deliberate user edits, and update signal values immutably with
  `set()` or `update()`;
- use a discriminated union when loading, success, empty, and error states are
  mutually exclusive;
- keep RxJS at asynchronous boundaries such as `HttpClient`, router streams,
  cancellation, and multi-event workflows.

Signal-first does not mean that every feature needs NgRx SignalStore. A small
service backed by native Angular signals is already a signal store in the
architectural sense. Introduce `@ngrx/signals` only when demonstrated needs such
as cross-feature coordination, normalized client entities, reusable store
features, undo/redo, or a comparably complex workflow outweigh the additional
dependency and abstraction.

Use the narrowest state owner:

1. A plain local variable for non-reactive implementation details.
2. A component signal for mutable view state.
3. A computed signal for derived view state.
4. A feature-scoped service only when sibling or nested routes must share state.
5. A state-management library only after real cross-feature coordination,
   normalized client entities, undo/redo, or similarly complex workflows exist.

Represent exclusive states explicitly:

```ts
type LoadState<T> = { kind: 'loading' } | { kind: 'empty' } | { kind: 'success'; value: T } | { kind: 'error' };
```

Do not model the same lifecycle with unrelated `isLoading`, `data`, and `error`
signals, because impossible combinations then become representable.

Signals own synchronous UI state. RxJS remains appropriate at asynchronous
boundaries such as `HttpClient`, route streams, cancellation, or workflows that
combine multiple events over time. Subscribe or convert once near the feature
that owns the result and tie subscriptions to the Angular lifecycle.

Effects synchronize state with an external system such as storage, telemetry,
or an imperative browser API. They are not a general state propagation tool.

## HTTP and contracts

Browser API services are small typed adapters around `HttpClient`. They use
relative `/api` URLs so development uses the proxy and production can route the
same paths to the API deployment.

The application interceptor attaches an in-memory access token exclusively to
URLs beginning with relative `/api`. Absolute and third-party requests never
receive the token. Keycloak refreshes sessions for active users and ends the
session after 30 minutes without browser activity. Browser code must not write
access, refresh, or ID tokens to local storage, session storage, IndexedDB, or
cookies managed by the application.

The frontend owns its request and response types. It does not import NestJS
DTOs, controller interfaces, server domain objects, or server libraries. This
keeps the deployment boundary honest and lets the UI model only what it uses.

Keep transport mapping in the API boundary when the wire shape differs from
the display shape. Keep presentation state in the page, not in a stateless API
service. Introduce a shared error model only when multiple screens can render
meaningfully different recovery paths.

## Forms and templates

Use typed reactive forms for production forms. Angular 21 Signal Forms are
experimental, so they are not the default. The same rule applies to
`resource()` and `httpResource()`: they may be adopted intentionally after
their maturity and the migration cost are reviewed, but ordinary features do
not need them.

Use `@if`, `@for`, and `@switch` instead of legacy structural directives in new
templates. Use `@defer` only for heavy non-critical UI; route-level lazy loading
already provides the main code-splitting boundary.

## Styling and accessibility

Angular Material supplies interaction primitives. `DESIGN.md` supplies the
product's visual rules and is the source of truth for the whole application.
Tailwind CSS v4 projects those semantic tokens into utilities from
`apps/web/src/styles.css`. Global theme, reset, and tokens belong to the web
app; templates and Angular `host` metadata use the semantic utility contract
documented in `DESIGN.md`. The frontend is Tailwind-first, so do not create a
component stylesheet by default. Add one only when Tailwind cannot express a
third-party integration or complex stateful selector clearly, and document the
exception in the component.

Do not use Tailwind's default palette or arbitrary feature-level colors and
radii. New visual roles are designed in `DESIGN.md` and added to the global
`@theme` block before feature code consumes them. This keeps feature libraries
visually consistent without introducing a separate shared UI Nx project.

Do not wrap Material components solely to rename them. Create a shared UI
component only when it adds stable InvestFlow behavior, semantics, or visual
composition used by at least two contexts.

Every async screen renders the states users can encounter and gives status
changes appropriate live-region semantics. Use semantic HTML, accessible names,
visible focus, keyboard operation, sufficient target sizes, and reduced-motion
support. Error text must be useful and must not expose raw transport details.

## Environments

The web app uses Angular's standard file-replacement pattern with two typed,
committed configurations:

- `environment.ts` contains localhost settings for local development.
- `environment.production.ts` contains the production Keycloak public-client
  settings and replaces the development file in production builds.

Environment files are compiled into the browser bundle and therefore cannot
contain secrets. Update the production file when the deployment endpoint
changes and rebuild the application. Do not add build-time file generation or
runtime configuration loading unless the product needs more deployment
environments or one immutable bundle deployed to multiple environments.

## Testing pattern

Use Angular-native Vitest through Nx:

- Test feature stores and state services directly. Cover meaningful lifecycle
  transitions such as loading, success, empty, error, retry, and overlapping
  request protection when those states exist.
- Keep route components thin. Component tests verify that the class exposes
  store state and delegates user intent; instantiate the class in an injection
  context instead of compiling or rendering its template.
- Do not assert HTML structure, selectors, CSS classes, snapshots, or static
  product copy. Templates and styling are validated by strict compilation,
  linting, production builds, accessibility review, and manual browser checks.
- Keep focused non-UI boundary tests where they protect HTTP contracts,
  authentication security, route composition, or application bootstrap.
- Test pure helpers without Angular's test environment.

Add browser end-to-end tests when the product has a critical multi-screen user
journey worth protecting. Do not create an E2E project merely because an app
exists.

## Extraction triggers

Keep one context web library until a split has a clear payoff. Create another
Nx project only when one of these pressures is present:

- a feature has independent ownership or release cadence;
- code is consumed by a second context or application;
- project-level dependency rules need to prohibit an import;
- build and test isolation measurably improves affected work;
- a large feature has a stable public boundary and changes independently.

Folder size alone is not an extraction trigger. Prefer internal folders before
additional projects. If a split becomes necessary, use a small vocabulary such
as `web-feature`, `web-data-access`, `web-ui`, and `web-util`, and add matching
Nx dependency constraints in the same change.

## Explicit non-goals

The baseline does not include NgRx, another store, SSR, hydration, service
workers, micro-frontends, OpenAPI code generation, a separate design-system Nx
library, or experimental Angular state and form APIs. Any of these can be added
later when a concrete product or operational requirement justifies its cost.
