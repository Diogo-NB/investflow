# Frontend Patterns

## Current app and ownership

InvestFlow's Angular 21.2 frontend is a client-rendered authenticated application.
Opening `/` requires Keycloak login and then shows a Portuguese welcome page,
authenticated identity, and logout. Unmatched browser routes redirect to `/`.
The welcome page links to offer CRUD under `/ofertas`; the bounded context owns
its business requests and presentation.

```text
apps/web
  bootstrap, providers, authentication, shell, welcome, top-level routes

libs/investment-simulator/web      lazy offer CRUD presentation
  routes/                         context route composition
  pagination/                     local generic pagination contract
  <plural-feature>/               e.g. offers or simulations
    feature/                      route pages and orchestration
    api/                          browser API adapters
    models/                       transport and display types
    ui/ and utils/                only when useful
```

Keep the app a thin composition root. A generic welcome page belongs there;
business screens belong in one lazy-loaded web library per bounded context.
Export composition contracts, normally routes, through `src/index.ts`. Use
workspace aliases between projects and relative imports within a project.
Browser libraries define their own HTTP types and never import server internals.
InvestFlow has a single frontend app. Keep browser types, components, state,
and utilities in the app or the owning context web project; reuse local code
through folders and relative imports. Do not extract reusable frontend Nx
libraries, including shared types, UI, data-access, state, or utility libraries.
The existing context web projects organize the app's features and expose routes;
they are not reusable frontend packages.

The frontend `PaginatedResult<Item>` lives in
`libs/investment-simulator/web/src/lib/pagination/paginated-result.type.ts` and
is imported locally with `import type`. Keep it internal to the web project.
The backend maintains its own pagination interface in `shared-types`. Their
wire shapes match, but neither platform imports the other's contract. Keep
feature-specific item models local and use the generic wrapper for page results.

Use the installed Nx generators for apps and components. Repository conventions
have precedence over generic Angular scaffolding instructions: do not create a
separate Angular CLI workspace, install a global CLI, or upgrade dependencies
implicitly. Keep Angular, Nx, Material, TypeScript, Node, and the lockfile versions.
Components default to OnPush and no stylesheet; app generation defaults to zoneless.
Preserve platform, scope, and project-type tags and ESLint dependency boundaries.

## Angular and state

Use standalone components, zoneless change detection, OnPush, `inject()`, strict
templates, and functional providers, guards, interceptors, and resolvers. Import
only the directives, pipes, and components used by a template. Use signal inputs,
outputs, and queries; use `model()` only for intentional two-way editing.

Native `signal()` owns mutable UI state; keep writable signals private in state
services and expose read-only signals. Use `computed()` for derivation and
`linkedSignal()` for derived state that also accepts deliberate edits. Update
values immutably. Represent mutually exclusive async states explicitly rather
than with unrelated loading/data/error booleans.

Start state in its narrowest owner: component-local signals, then a feature-scoped
service when sibling or nested routes share it. Introduce a state library only
for demonstrated coordination, normalized entities, undo/redo, or comparable
workflow complexity. A route page can coordinate a small use case directly.
Extract presentational components for reuse, independent interaction complexity,
or substantially improved readability.

Keep RxJS at asynchronous boundaries. Use `AsyncPipe`, `toSignal()`, or
`takeUntilDestroyed()` to own subscriptions. Effects synchronize with external
systems; they do not copy state between signals. Use `@if`, `@for`, and `@switch`,
with explicit tracking in loops. Put host bindings in decorator `host` metadata.
Lazy-load context routes. Defer only heavy, non-critical route content;
keep primary content available immediately. Use `NgOptimizedImage` for content
images with declared dimensions and appropriate LCP priority.

## Approved experimental APIs

Decision dated 2026-10-06: the user explicitly approved Angular 21 Signal Forms,
`resource()`, and `httpResource()` while retaining the installed toolchain.
These APIs remain experimental on this major; approval does not make them stable.
Offer reads now use `httpResource()` and the create/edit form uses Signal Forms.
These APIs serve real workflows; there are no demonstration-only requests. [Angular 21 roadmap](https://v21.angular.dev/roadmap).

- Prefer Signal Forms for new forms. A signal owns the model; define field rules
  through the form schema and handle pending, invalid, submitting, and server
  failure states without losing user input.
- Prefer `httpResource()` for reactive HTTP reads and `resource()` for appropriate
  asynchronous loaders. Create resources in an Angular injection context; their
  owner controls lifetime, and parameter changes/destruction cancel pending work.
  Handle loading, empty, success, and failure states without reading a missing
  value; use reload for retry and avoid parallel duplicate work.
- Use HttpClient/RxJS for mutations, commands, and asynchronous event workflows.
  Do not send writes from resource loaders or derived state.

The benefit is native integration with signal state and explicit async lifecycle.
Experimental signatures and semantics can change outside a major upgrade; review
version-specific release notes before any approved dependency update. Keep form
logic and data boundaries local so migration affects the owning feature. If a
requirement is unsupported, typed reactive forms and a signal-backed HttpClient
service with lifecycle-owned subscriptions remain fallback implementations.
Document a frontend-wide fallback change before adopting it. Other experimental
APIs, including preview interaction primitives, need their own adoption decision;
Material/CDK remain the interaction baseline.

## Authentication and HTTP

Application-wide authentication lives in the app. Feature libraries remain
unaware of Keycloak and use relative `/api` URLs. The development proxy forwards
those paths to `http://localhost:3000`; production hosting must route them to the
API and serve the SPA entrypoint for browser routes.

Use the existing `keycloak-angular` public client `investflow-web`, realm
`investflow`, and Keycloak JS adapter. Authorization Code Flow uses PKCE S256 and
`login-required`. No application roles or custom credential form are introduced.
Tokens stay in memory; never persist access, refresh, or ID tokens in application
storage or cookies. The bearer interceptor matches only `/api` and `/api/...`;
absolute URLs, protocol-relative URLs, and lookalike prefixes receive no token.

One explicit Angular initializer calls Keycloak and rejects errors or a false
authenticated result before the shell can bootstrap. `provideKeycloak()` receives
no `initOptions`: the installed library's built-in initializer catches errors,
which would otherwise permit an unauthenticated shell. Start refresh tracking
only after successful initialization. Login returns to the current pathname and
query string, preserving direct offer links and filters across reloads. Fragments
are excluded from the configured return URL. The bootstrap fallback shows a safe
Portuguese error and a reload retry outside the Angular rendering lifecycle.

The installed refresh service checks activity when tokens expire: active users
refresh, while users inactive for 30 minutes log out. This is an expiry-driven
policy, not an independent timer firing exactly at 30 minutes. Logout redirects
to the app origin; immediate-login initialization then applies again. A failed
logout shows safe text and permits retry. Duplicate pending logout intent is
ignored. Identity is derived from token claims and updates on Keycloak events.

Own browser transport types locally. Keep API adapters small and presentation
state in its owner. Normalize errors only when the UI has distinct recovery paths;
never render raw transport/provider errors. Monetary values cross the boundary as
decimal strings; preserve their original precision and round only for display.

## Styling and accessibility

`DESIGN.md` is the visual source of truth. Tailwind v4 projects its semantic tokens
through `apps/web/src/styles.css`. This file owns the reset, font faces, and
Tailwind configuration. Product templates and host metadata use semantic utility
classes; no default Tailwind colors or local arbitrary palette/radius values.

Zed's project settings in `.zed/settings.json` use `tailwindcss-intellisense-css`
for CSS files in place of the default CSS language server. This recognizes
Tailwind directives such as `@theme` and `@apply` while retaining standard CSS
IntelliSense and diagnostics. See [Zed's Tailwind CSS configuration](https://zed.dev/docs/languages/tailwindcss).

`apps/web/src/material-theme.scss` is the global Sass exception required by the
Material theming API. It supplies typography and density, projects the same color
and radius tokens into Material, and defines integration focus/reduced-motion
rules. Keep global stylesheet order as CSS tokens followed by the Material theme.
Do not create component stylesheets unless an integration or complex selector
requires one; document that exception. Do not wrap Material solely to rename it.

The approved design is light-only, with neutral surfaces, green accents, and
locally hosted IBM Plex Sans. Its font files and Open Font License ship in public
assets. There are no remote font requests, stock imagery, or icon-font dependency.
Keep Portuguese copy, semantic landmarks, a skip link, visible focus, readable
contrast, keyboard-operable actions, 44px targets, live status/error messages, and
reduced-motion support. Color never communicates state alone.

## Configuration

Keep typed, committed `environment.ts` and `environment.production.ts`, using
production file replacement. They contain only public Keycloak settings. The
production URL is a placeholder until deployment supplies the real endpoint;
configuration changes require a rebuild. Do not introduce runtime configuration
loading without a concrete deployment need and a new architecture decision.
Local realm provisioning and production identity infrastructure are separate.
This frontend recreation requires no database reset or realm change.

## Testing and project boundaries

Use Angular-native Vitest through Nx. Test state/service transitions, request
coordination, authentication initialization and bearer boundaries. Component tests
instantiate classes in an injection context and verify state exposure or intent
delegation without rendering templates. Do not assert DOM structure, selectors,
CSS classes, snapshots, or static copy. Pure helpers need no Angular environment.

Strict template compilation, lint, builds, and browser checks validate presentation.
Before merging, run frontend lint, tests, development/production builds, the full
workspace check, and the API prune target when changing workspace composition.
Manually check local Keycloak login, reload, logout, failure/retry, keyboard focus,
responsive reflow, and reduced motion. Add an E2E project only for a demonstrated
critical product journey; the workspace includes none.

Keep one web project per bounded context within the single frontend app.
Organize repeated browser code within its owning project; repeated use does not
justify a reusable frontend library. Changing this project rule requires an
explicit architecture decision from the user.

The baseline excludes NgRx, SSR, hydration, service workers, micro-frontends,
OpenAPI generation, and a separate design-system library. Introducing one of these
requires a concrete need and approval for the architecture change.

## Offer CRUD implementation

`investment-simulator-web` is a buildable Angular library with Angular-native
Vitest. Only its context routes are exported. The app lazy-loads them at
`/ofertas`; list, details, and the reusable editor are lazy route components.
Confirmation dialogs are loaded on demand. Native browser transport types stay
under `offers/models`; server projects remain outside its dependency graph.

Page-scoped signal services own list/resource coordination, detail deletion, and
form state. `OfferForm` initializes one original snapshot when mounted; its
state owns a private model and baseline. Do not reload an editor's source over
unsaved input. Form fields bind through `[formField]` to Material inputs and `mat-select`.
Material selects use their ControlValueAccessor bridge to Signal Forms;
`mat-option` supplies popup interaction and keyboard behavior. Changing remuneration clears the rate, because its unit changed.
`OfferMaturityDate` implements the Signal Forms control contract around Material's
calendar. Its isolated typed FormControl is a widget adapter, not feature state:
it reconciles the model into Material's date/input boundary, preserves partially
typed text, and mirrors pending disablement. Strict DD/MM/AAAA parsing converts
to YYYY-MM-DD. Local Date objects stay inside this boundary; never use UTC/ISO
instant conversion for the picker. The model, comparisons, and HTTP payloads
continue to use calendar strings.
Submit validates/touches fields, focuses an invalid field, and prevents duplicate
writes. Pending commands lock the form; explicit retries retain input. Writes
are never automatically retried, since a lost response may hide a committed write.

List filters are `q` (issuer name), `titleType`, and `page` URL parameters. A
submitted search or changed type resets to page 1. These parameters are carried
to detail/editor links and back to the list. The list fixes page size at 20.
Obsolete resource reads are canceled. A stale page beyond the current last page
is corrected through router navigation, not by copying signals with an effect.

Pure browser helpers shift decimal strings to convert percentages and fractions.
They reject zero, invalid input, and values outside existing Decimal(65,30)
storage. They never use Number for financial rates. Calendar validation and
`dd/mm/aaaa` display do not construct local-time instants. PATCH includes only
changed mutable fields; issuer/title are displayed as immutable information.

The functional editor deactivation guard confirms unsaved navigation; the native
before-unload handler covers document exits. Dialogs manage focus. The app's
router outlet focuses its main landmark on route activation. Save success clears
the dirty baseline before redirecting to a fresh detail read. A failed detail
read after save is a read failure, not permission to repeat the write.

For unit tests of resources, flush HTTP and await Angular's pending tasks before
asserting settled state. Rendered checks remain browser checks, not unit DOM
assertions. Browser/API verification uses dedicated offers and does not reset
local databases or modify Keycloak accounts.
