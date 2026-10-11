# Frontend Patterns

## Decision and status

Decision dated 2026-10-10: the frontend is a React 19 + Vite 8 SPA built with
Nx. Status:

1. Done: toolchain, `apps/web` as an `@nx/react` Vite app with Keycloak
   startup, the shell, the welcome page, and top-level routes. Earlier
   frontend code and its dependencies were removed, and the browser offer CRUD
   with them.
2. Done (reordered 2026-10-10, because running simulations is what users need
   most): `investment-simulator-web` as an `@nx/react` library with the
   simulation workspace under `/simulacoes` (see Simulation workspace
   behavior). It brought TanStack Query, React Hook Form, Zod, Base UI, the
   date field, and confirmation dialogs.
3. Next: the offer list and details, then the offer editor, mounted under
   `/ofertas` by the same route factory.
4. Finally: full verification (see Testing and verification).

Each step keeps `pnpm check` green. The Keycloak realm doesn't change; API
additions are recorded with the feature that needs them. Rebuild features from the recorded behavior (App shell and
authentication behavior, Offer CRUD behavior) and design them as idiomatic
React. Don't transliterate earlier implementations or their structure.

## Stability policy

Use modern, mainstream React: stable, documented APIs and widely adopted
libraries only. Don't use canary or experimental React builds, `unstable_*` or
`experimental_*` APIs, React Server Components, React Router Framework or RSC
modes, or pre-1.0 and niche libraries. Adopting one of these needs a separate,
dated decision recorded in this guide. Vendored agent skills don't override
this policy.

## Stack and versions

Install the latest stable release of each line below and commit the lockfile.
Add a package together with its first consumer: TanStack Query, React Hook
Form, Zod, Base UI, and react-day-picker arrived with the simulation workspace.

| Concern                | Package                                                                      | Line (current at decision)        |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| UI runtime             | `react`, `react-dom`                                                         | 19.x (19.3.0)                     |
| Build and dev server   | `vite`, `@vitejs/plugin-react`                                               | 8.x (8.3.4), 6.x (6.1.2)          |
| Nx integration         | `@nx/react`, `@nx/vite`                                                      | 22.6.3, matching the workspace Nx |
| Routing                | `react-router` (Data mode)                                                   | 8.x (8.4.0)                       |
| Server state           | `@tanstack/react-query`                                                      | 5.x                               |
| Forms                  | `react-hook-form`, `zod`, `@hookform/resolvers`                              | 7.x, 4.x, 5.x                     |
| Interaction primitives | `@base-ui/react`                                                             | 1.x                               |
| Calendar popup         | `react-day-picker`                                                           | latest stable major               |
| Styling                | `tailwindcss`, `@tailwindcss/vite`                                           | 4.x (keep installed line)         |
| Identity               | `keycloak-js`                                                                | 26.2.4 (keep)                     |
| Tests                  | `vitest`, `jsdom`, `@testing-library/react`                                  | 4.x (keep `^4.0.8`), keep, 16.x   |
| Lint                   | `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y` | latest stable                     |

TypeScript `~5.9`, Node 22 (`.nvmrc`), pnpm 10, and Nx 22.6.3 stay. The
`@nx/vite` 22.6.3 peer range accepts Vite 8 and Vitest 4. Vitest 5 and Nx 23
aren't adopted.

React Compiler 1.0 is stable, but its integration with `@vitejs/plugin-react` 6
goes through `@rolldown/plugin-babel`, which is pre-1.0. Under the stability
policy the compiler is deferred. Revisit when that integration is stable.

## App and ownership

InvestFlow's frontend is a client-rendered authenticated SPA. Opening `/`
requires Keycloak login and then shows a Portuguese welcome page, the
authenticated identity, and logout. Unmatched browser routes redirect to `/`.
The welcome page and the header link to each mounted context feature
(`/simulacoes`; the offer CRUD under `/ofertas` comes next). The bounded context owns its
business requests and presentation.

```text
apps/web                          @nx/react Vite application
  src/main.tsx                    Keycloak startup, router, createRoot().render
  src/app/                        routes, shell, welcome, route error
  src/app/auth/                   session store (session.ts), React hooks

libs/investment-simulator/web     @nx/react library, bundled by the app
  routes/                         context route composition (public API)
  pagination/                     local generic pagination contract
  <plural-feature>/               e.g. offers or simulations
    feature/                      route components, feature hooks, orchestration
    api/                          fetch adapters and TanStack Query key factories
    models/                       transport and display types
    ui/ and utils/                only when useful
```

Keep the app a thin composition root. A generic welcome page belongs there.
Business screens belong in one lazy-loaded web library per bounded context. The
context library isn't buildable: the app's Vite build bundles it, so it needs
no separate package output. Preserve the `scope:*`,
`platform:browser`, and `type:*` tags and the ESLint dependency boundaries.

Export composition contracts, normally a route factory, through `src/index.ts`.
That index is the only barrel. Inside a project, import files directly with
relative paths. Use workspace aliases between projects. Browser libraries
define their own HTTP types and never import server internals. InvestFlow has a
single frontend app: keep browser types, components, hooks, state, and
utilities in the app or the owning context web project. Don't extract reusable
frontend Nx libraries, including shared types, UI, data-access, state, or
utility libraries.

The frontend `PaginatedResult<Item>` belongs in
`libs/investment-simulator/web/src/lib/pagination/paginated-result.type.ts`
when that library is rebuilt, and is imported locally with `import type`. Keep it internal to the web project.
The backend has its own pagination interface in `shared-types`. Their wire
shapes match, but neither platform imports the other's contract.

Use the installed Nx generators (`@nx/react:application`, `@nx/react:library`,
`@nx/react:component`) with `bundler: vite`, `unitTestRunner: vitest`, and no
style files. Don't create a separate Vite or CRA workspace, install a global
CLI, or upgrade dependencies implicitly.

## Composition contract

The context library exports a route factory:

```ts
export function investmentSimulatorRoutes(deps: InvestmentSimulatorDeps): RouteObject[];

interface InvestmentSimulatorDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}
```

The app passes its bearer-attaching `authorizedFetch` and spreads the result
into its shell routes. The factory returns top-level paths (`simulacoes`, later
`ofertas`), and each page module loads through route `lazy`. The library puts `deps` in its own internal
context, which its API adapters read. Features never import Keycloak or app
modules, and they use relative `/api` URLs.

## React defaults

- Function components with named exports. Files are kebab-case:
  `offer-list.tsx` for components, `use-offer-list.ts` for hooks. Components are
  PascalCase and hooks start with `use`.
- Props flow down and callbacks flow up. Keep props minimal and typed. Prefer
  composition (children, compound components, explicit variant components) over
  boolean mode props.
- React 19 APIs: pass `ref` as a prop (no `forwardRef`), and render
  `<Context value>` directly. Don't use class components, legacy context, or
  `defaultProps`.
- Follow the Rules of React: components and hooks are pure, hooks are called
  unconditionally at top level, and props and state are never mutated.
  `eslint-plugin-react-hooks` enforces this and its findings aren't suppressed.
- Write plain code without `useMemo`, `useCallback`, or `memo`. Add one only for
  a measured cost or when a stable identity is part of a contract, such as an
  effect dependency, a context value, or a third-party API.
- Never define components inside components. Hoist static data and JSX out of
  render.
- Use `StrictMode` in development.

## State

Start state in its narrowest owner:

1. Component-local `useState`, or `useReducer` when transitions are
   interdependent.
2. A feature hook (`use-offer-editor.ts`) that owns a route page's orchestration.
3. Lift state to the nearest common parent when siblings need it, then a
   feature-scoped context when prop passing becomes noisy.

Derive values during render instead of storing them. Represent mutually
exclusive async states with a discriminated union, not unrelated
loading/data/error booleans. Update state immutably.

`useEffect` only synchronizes with systems outside React: subscriptions, the
DOM, `beforeunload`, and focus. Don't use effects to copy, reset, or derive
state, or to respond to user events. Put that logic in the event handler, or
reset local state with a `key`. Don't add Redux, Zustand, Jotai, or another
state library unless there's demonstrated cross-feature coordination,
normalized client entities, undo/redo, or comparable workflow complexity.

## Server state and HTTP

TanStack Query owns server state. Create one `QueryClient` in the app.

- **Reads:** `useQuery` with a `queryFn` that passes the provided `signal` to
  `fetch`, so obsolete reads are canceled. A key factory per feature in `api/`
  (`offerKeys.list(filters)`, `offerKeys.detail(id)`) keeps invalidation
  precise. Pass `placeholderData: keepPreviousData` only where showing the
  previous page is intended. Use `refetch` for retry.
- **Writes:** `useMutation` with `retry: 0`. Writes are never retried
  automatically, because a lost response may hide a committed write. Disable
  the submit while `isPending`. After success, invalidate the affected keys and
  navigate.
- Don't use route `loader`/`action` functions or `<Form method="post">` for data.
  TanStack Query and React Hook Form own reads and writes, and route `lazy` is
  used for code splitting.
- Don't fetch in `useEffect`.
- Keep API adapters small: relative `/api` URLs, typed request and response
  values, no presentation state. API error bodies carry a pt-BR `message`
  written for the user: show `ApiError.userMessage` and do not keep copy per
  error code. Use `code` and `details` only for behavior, such as which field to
  focus or how to recover. Network and bodiless failures get a local generic
  message. Never render raw transport or provider errors.
- Complex screens read from screen-oriented queries (Backend for Frontend,
  see `docs/architecture/project-structure.md`). The browser formats and
  arranges what it receives and owns form validation and interaction, but it
  doesn't re-implement domain rules to derive business facts.
- Monetary values cross the boundary as decimal strings. Preserve their
  original precision and round only for display. Never use `Number` for
  financial rates.

## Routing and URL state

Use React Router Data mode: `createBrowserRouter` with route objects and
`<RouterProvider>`. Context routes load through `lazy`. Use route
`ErrorBoundary` for unexpected failures. Expected states (loading, empty,
missing record, retryable failure) render inside the page.

URL search parameters are state. Read and write them with `useSearchParams`,
and preserve unrelated parameters. Parse and validate them, since URL values
are untrusted strings. Correct invalid or stale values (such as a page beyond
the last page) by navigating with `replace`, not by copying them into state
with an effect.

The app's shell moves focus to the main landmark when the route changes.

## Forms

Use React Hook Form with a Zod schema per form through `zodResolver`.

- Initialize an editor once from a single server snapshot via `defaultValues`.
  Don't reset it from a later read while the user has unsaved input.
- Validation appears after touch or submit. Submit focuses the first invalid
  field (`shouldFocusError`). Pending submits disable the form, prevent
  duplicate writes, and keep input on failure so an explicit retry resends it.
- Connect Base UI controls through `Controller`, and native inputs through
  `register`.
- Unsaved changes: `useBlocker` confirms in-app navigation, and a `beforeunload`
  listener covers document exits. Both are active only while the form is dirty
  and not submitting.

## Authentication

Application-wide authentication lives in the app. Use `keycloak-js` directly
with the existing public client `investflow-web` and realm `investflow`. Use
Authorization Code Flow with PKCE S256 and `login-required`. No application
roles or custom credential form are introduced.

- `main.tsx` awaits `startAuthentication()` (`app/auth/session.ts`) before it
  creates the router and calls `createRoot().render()`. A rejected init or a
  `false` authenticated result reveals the static failure markup in
  `index.html` with a reload action, so the shell never renders
  unauthenticated. The router is created after init because init removes
  Keycloak's callback fragment from the URL.
- Login returns to the current pathname and query string, preserving direct
  offer links and filters across reloads. Fragments are excluded.
- Tokens stay in memory. Never persist access, refresh, or ID tokens in
  application storage or cookies.
- `authorizedFetch`, added with the first API consumer, attaches the bearer
  only to `/api` and `/api/...`. Absolute URLs, protocol-relative URLs, and
  lookalike prefixes get no token. It calls `updateToken` before sending.
- Refresh tracking starts only after successful init. When a token expires,
  active users refresh and users inactive for 30 minutes log out. This is an
  expiry-driven policy, not an independent wall-clock timer.
- `startAuthentication` resolves an `AuthSession` external store (subscribe,
  token claims, logout) that `main.tsx` provides through `AuthSessionContext`.
  `useIdentity()` reads it with `useSyncExternalStore`. `useLogout()` keeps the
  logout status in local state, because only the logout control needs it.
- Logout redirects to the app origin. A failed logout shows safe text and
  permits retry. Duplicate pending logout intent is ignored.

## Styling and accessibility

`DESIGN.md` is the visual source of truth. Tailwind v4 loads through
`@tailwindcss/vite`. `apps/web/src/styles.css` owns the reset, font faces,
design tokens, and Tailwind configuration. Components use semantic utility
classes in `className`, never default Tailwind colors or local arbitrary
palette or radius values. No CSS modules, CSS-in-JS, or component stylesheets
unless a third-party integration requires one. Document any exception here.
Exception: `styles.css` imports `react-day-picker/style.css` for the calendar
grid and themes it through its `--rdp-*` variables with the design tokens.
`styles.css` also declares `@source` for each context web library, because
Tailwind does not scan outside the app by default.

Base UI supplies interaction primitives: Dialog and AlertDialog, Select, Field,
Popover, and Menu. They're unstyled and accessible by default, and we style
them with the same semantic utilities. Don't create wrapper components that
only rename a primitive. A local `ui/` component is justified when it adds
product behavior or replaces repeated markup.

The maturity date field is a strict DD/MM/AAAA text input with a calendar popup
(`react-day-picker` inside a Base UI Popover). Local `Date` objects stay inside
that widget boundary. Never convert through UTC or ISO instants. The form
model, comparisons, and HTTP payloads use `YYYY-MM-DD` calendar strings.

Keep the approved design light-only with locally hosted IBM Plex Sans and no
remote font requests, stock imagery, or icon font. Keep Portuguese copy,
semantic landmarks, a skip link, visible focus, readable contrast,
keyboard-operable actions, 44px targets, live status and error messages, and
reduced-motion support. Color never communicates state alone.

## Configuration

Keep typed, committed environment modules for development and production. They
contain only public Keycloak settings. `environments/environment.ts` selects
one through Vite's mode (`import.meta.env.MODE`), which is replaced at build
time, not fetched at runtime. `nx build web` uses the production mode and
`--configuration=development` the development mode. The production URL is a placeholder until deployment supplies
the real endpoint, so configuration changes require a rebuild. Don't introduce
runtime configuration loading without a concrete deployment need and a new
architecture decision. The Vite dev server proxies `/api` to
`http://localhost:3000`. Production hosting must route `/api` to the API and
serve the SPA entrypoint for browser routes.

## Testing and verification

Use Vitest through Nx with jsdom. Testing is state-first:

- Test feature hooks with `renderHook`, wrapped in a fresh `QueryClient`
  (`retry: false`) and the library's deps context with a fake `fetch`. Cover
  loading, success, empty, failure, retry, cancellation, and duplicate-write
  prevention when those states exist.
- Test pure helpers (decimal shifting, calendar parsing, list context) without
  React.
- Test the authentication boundary: init rejection, bearer matching, refresh
  and inactivity policy, and logout retry. Also test route definitions.
- Don't query DOM nodes or assert markup, CSS classes, snapshots, or static
  copy in unit tests. Component tests are limited to hook orchestration.

Typecheck, lint, builds, and browser checks validate presentation. Before
merging a frontend change, run frontend lint, tests, development and production builds,
`pnpm check`, and `pnpm nx run api:prune` so browser packages stay out of the
API artifact. Manually check local Keycloak login, reload, logout,
failure/retry, keyboard focus, responsive reflow (320–1440px, 200% zoom),
reduced motion, and axe A/AA. Add an E2E project only for a demonstrated
critical product journey. The workspace includes none.

The baseline excludes SSR and RSC, React Router Framework mode, service
workers, micro-frontends, OpenAPI generation, a global state library, and a
separate design-system library. Introducing one requires a concrete need and
approval of the architecture change.

## App shell and authentication behavior

Recorded from the earlier implementation on 2026-10-10. `apps/web` implements
it.

- Nothing authenticated renders before Keycloak confirms a session. Login is
  required, using Authorization Code + PKCE S256.
- Login returns to the requested path and query, without the fragment.
- While the session starts, the page shows "Iniciando sua sessão…". A failed
  or unauthenticated start shows "Não foi possível iniciar sua sessão." with
  "Tentar novamente" (reload). Provider details are never shown.
- When the access token expires, users active in the last 30 minutes
  (pointer, touch, key, click, or scroll) are refreshed silently. Inactive
  users, and users whose refresh fails, are logged out to the app origin.
- The identity shown is the first non-blank string claim among `name`,
  `preferred_username`, and `email`, falling back to "Usuário autenticado". It
  follows token refreshes.
- Logout returns to the app origin. While pending, the action reads "Saindo…"
  and ignores repeats. A failure shows "Não foi possível sair. Tente
  novamente." as an alert linked to the button, and allows a retry.
- Only relative `/api` and `/api/...` requests carry the bearer, refreshed
  first (built with the first API consumer; see Authentication).
- The shell has the skip link "Ir para o conteúdo", the home link "InvestFlow,
  página inicial", "Sua conta" with the identity, and "Sair". Each navigation
  moves focus to the main landmark without scrolling.
- Home: title "Início | InvestFlow", an "Início" section label, the heading
  "Bem-vindo ao InvestFlow.", and the subtitle "Um espaço para suas próximas
  decisões de investimento.". Unexpected render errors show a safe message
  with a reload action inside the shell.

## Simulation workspace behavior

Built 2026-10-10. A simulation is one title (CDB, LCI or LCA): its terms are fixed when it is
created. Each calculation ("cálculo") records an investment under those terms;
the latest one is the current state, earlier ones are its history.

- `/simulacoes` lists the user's simulations, 20 per page (`page` URL
  parameter, corrected by navigation when stale). Each row shows the issuer
  ("Sem emissor" when the terms have none) and
  whether the terms are custom or from a catalog offer, the remuneration, the
  principal, the period, and the net value of the latest calculation, with a
  textual "Desatualizado" tag when it predates the current methodology.
  Desktop uses a table; below 1024px, labeled rows. The whole row or card
  opens the simulation: one link per entry, stretched over the table row on
  desktop.
- `/simulacoes/nova` and `/simulacoes/:id` show the inputs beside the results
  (stacked below 1024px), split into the offer form and the simulation form:
  - "Termos do título" (offer form): title type, hinted with its income-tax
    treatment and minimum term from the options query (the API enforces the
    minimum term; the form does not repeat it), optional issuer ("Sem emissor"), remuneration
    kind, rate in the kind's unit, maturity, liquidity. Editable on a new
    simulation; a saved simulation shows them read only, pointing to
    "Duplicar" for other terms. Changing the kind clears the rate and the
    curve. Liquidity defaults to "No vencimento".
  - "Investimento" (simulation form): principal, investment date, and the
    index curve for indexed kinds. The curve list is filtered by the terms'
    index, auto-selects a sole curve, shows its coverage, and warns when the
    period may exceed it.
- The investment and maturity date pickers grey out weekends and holidays.
  `BusinessDateField` (in the library's `business-calendar/` folder, for any
  screen that needs business days) reads them per year from
  `GET business-calendar/non-business-days?year=`; the browser holds no
  holiday rules. Typed dates are not blocked; the calculation still rejects a
  non-business day on its field.
- Terms are typed freely. On a new simulation, a catalog offer can fill them
  ("Preencher com uma oferta"); edits afterwards are flagged with "Restaurar
  termos da oferta". No catalog entry is created by a simulation.
- One "Calcular" action records a calculation: a new simulation sends its
  terms and first investment (`POST simulations`), a saved one only the
  investment (`POST simulations/:id/calculations`). When nothing changed and the latest calculation is current,
  it reads "Resultado atualizado" and is disabled. A rejected calculation saves
  nothing: the form keeps its edits as unsaved changes and the reason appears
  on the responsible field (principal, non-business day, curve coverage,
  deleted curve, period) and in the results panel. A new simulation stays on
  `/simulacoes/nova` until its first calculation succeeds, then opens its own
  page.
- A curve coverage rejection names the first gap the API reports ("A curva
  não tem valores entre 02/01/2029 e 28/12/2029 e em mais 2 períodos"). The
  domain groups consecutive missing rate references into ranges
  (`missingRanges`); the browser only phrases them.
- Results: the net value at maturity, then principal, gross balance, gross
  earnings, IOF, income tax, total taxes and net value, with the dates,
  business days, calculation instant in São Paulo time and the methodology
  version. "Evolução do saldo" and "Histórico de cálculos" are disclosures; a
  past calculation is selected with the `calculo` URL parameter.
- "Evolução do saldo" lists one row per month (business days, the month's
  earnings, accumulated earnings and the closing gross balance). Each month's
  button (`aria-expanded`) reveals that month's business days beneath it.
- Taxes: the IOF and income-tax rows name the applied rate ("IOF · isento pelo
  prazo", "Imposto de renda · 22,5%", or "Imposto de renda · isento" for LCI
  and LCA, whose dialog section explains the exemption without a bracket
  table). "Como os tributos foram calculados"
  (with an info icon) opens a short Base UI Dialog: the holding period, then
  for IOF and income tax one sentence on the rule, the formula string the API
  writes from the calculation's recorded values (shown as is), and the table with the applied row marked
  "seu caso" (not by color alone). Rates and tables come from the API, which
  takes them from the domain; the browser only finds the applied row by rate.
- A saved simulation's header offers "Nova simulação" (a blank form at
  `/simulacoes/nova`), "Duplicar" and "Excluir".
- "Duplicar" opens `/simulacoes/nova?a-partir-de=:id` prefilled with the
  terms and the latest investment, as editable custom terms; it is how rate,
  maturity and liquidity experiments are made. "Excluir" confirms in an AlertDialog. Unsaved edits are guarded by
  `useBlocker` and `beforeunload`.
- Rentabilidade (monthly, annualized, total) and "prazo restante" are not
  shown yet; the API does not compute them.
- "Desatualizado" on a calculation means the methodology changed since it was
  computed; the results panel also flags unsaved form edits. Older
  calculations are earlier versions, not stale ones.
- Reads are screen-oriented (Backend for Frontend): `simulation-options`
  (issuers, each remuneration kind with its index, curves and calculability,
  and catalog offers flagged as calculable or not), `simulation-workspaces/:id`
  (the simulation's origin and terms, and every calculation summary with its
  investment and business days, newest first), and
  `simulation-calculations/:id/monthly-balances` (months with their days
  nested), loaded for the selected calculation. The list uses `simulations`.
  Writes are `simulations`, `simulations/:id/calculations`, and
  `DELETE simulations/:id`.

## Offer CRUD behavior

The browser CRUD isn't implemented right now. When it's rebuilt, it must
provide these behaviors without change.

- Routes under `/ofertas`: list, details, create, and edit. Each loads lazily.
  Confirmation dialogs load on demand.
- List filters are the `q` (issuer name), `titleType`, and `page` URL
  parameters. A submitted search or changed type resets to page 1. These
  parameters carry through to detail and editor links and back to the list.
  The page size is fixed at 20. Obsolete reads are canceled. A stale page
  beyond the last page is corrected through navigation.
- Details show a grouped definition list with exact terms. Delete asks for
  confirmation, and a missing or deleted record has its own state.
- The editor initializes from one snapshot. Issuer and title are displayed as
  immutable information. Changing the remuneration kind clears the rate,
  because its unit changed. PATCH includes only changed mutable fields. A
  successful save clears the dirty baseline before redirecting to a fresh
  detail read. A failed detail read after save is a read failure, not
  permission to repeat the write.
- Pure helpers shift decimal strings to convert percentages and fractions. They
  reject zero, invalid input, and values outside Decimal(65,30) storage.
  Calendar validation and `dd/mm/aaaa` display never construct local-time
  instants.
- Browser and API verification uses dedicated test offers. It doesn't reset
  local databases or change Keycloak accounts.
