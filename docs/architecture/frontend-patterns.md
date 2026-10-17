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
   simulation workspace under `/simulacoes`. It brought TanStack Query,
   React Hook Form, Zod, Base UI, the date field, and confirmation dialogs.
   Reworked with D3 (see `docs/product/implementation-roadmap.md`): a
   simulation references an offer, chosen or created with "Duplicar e
   ajustar" or "Digitar termos", keeps one result, and "Salvar e calcular"
   sends its revision. With D4a the workspace shows the calculation status and
   polls it.
3. In progress, after the backend redesign of 2026-10-11 (mutable premises
   and asynchronous recalculation, see `project-structure.md`): done are the
   offer screens under `/ofertas` (D5) and the curve screens under `/curvas`
   (D6), mounted by the same route factory. Next is the rest of the
   simulation workspace's recorded behavior (impact notices, editing an own
   offer in place).
4. Finally: full verification (see Testing and verification).

Each step keeps `pnpm check` green. The Keycloak realm doesn't change; API
additions are recorded with the feature that needs them. Build features from
the recorded behavior (App shell and authentication behavior, Simulation
workspace behavior, Offer behavior, Curve behavior) and design them as
idiomatic React. Don't transliterate earlier implementations or their
structure.

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
| Charts                 | `recharts`, `react-is` (Recharts peer, on the React line)                    | 3.x (3.10.1), 19.x                |
| Styling                | `tailwindcss`, `@tailwindcss/vite`                                           | 4.x (keep installed line)         |
| Identity               | `keycloak-js`                                                                | 26.2.4 (keep)                     |
| Tests                  | `vitest`, `jsdom`, `@testing-library/react`                                  | 4.x (keep `^4.0.8`), keep, 16.x   |
| Lint                   | `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y` | latest stable                     |

TypeScript `~5.9`, Node 22 (`.nvmrc`), pnpm 10, and Nx 22.6.3 stay. The
`@nx/vite` 22.6.3 peer range accepts Vite 8 and Vitest 4. Vitest 5 and Nx 23
aren't adopted.

Charts use Recharts (2026-10-11): stable, widely adopted, declarative SVG
components with a keyboard accessibility layer, covering the line, area, and
bar charts the product needs. It needs no stylesheet; charts take the design
tokens as props (`var(--color-accent)`), disable animation because it runs
in JS outside the reduced-motion rule, and keep a table or text with the exact
values beside them. Add a shared chart component only when a second chart
repeats the setup.

React Compiler 1.0 is stable, but its integration with `@vitejs/plugin-react` 6
goes through `@rolldown/plugin-babel`, which is pre-1.0. Under the stability
policy the compiler is deferred. Revisit when that integration is stable.

## App and ownership

InvestFlow's frontend is a client-rendered authenticated SPA. Opening `/`
requires Keycloak login and then shows a Portuguese welcome page, the
authenticated identity, and logout. Unmatched browser routes redirect to `/`.
The welcome page and the header link to each mounted context feature
(`/simulacoes`, `/ofertas`, and `/curvas`). The bounded context owns its
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
into its shell routes. Right after login it also calls
`prefetchInvestmentSimulator(queryClient, deps)`, which starts the reads every
screen needs (the business calendar) without blocking the first render. The library also exports `investmentSimulatorSections`
(path, label, description, action, and canonical icon of each screen), which
the app's header and welcome page render, so the context owns how its
sections are named and drawn. The factory returns top-level paths (`simulacoes`, later
`ofertas` and `curvas`), and each page module loads through route `lazy`. The library puts `deps` in its own internal
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

Recorded 2026-10-11 for the redesigned model. Built so far: the offer choice,
"Duplicar e ajustar", "Digitar termos", one current result marked
"Desatualizado" when its premises changed, "Salvar e calcular" with the
revision, and the calculation status with its polling, "Tentar novamente",
the list's status tags, and the list filters. Not built yet: editing an own
offer in place from the workspace, with its impact notice. A
simulation always uses an offer, plus a curve when its
remuneration is indexed, and holds the principal and investment date. All of
them are editable. Its single result is recalculated asynchronously whenever
any of them changes.

- `/simulacoes` lists the user's simulations, 20 per page (`page` URL
  parameter, corrected by navigation when stale).
  - A filter bar of Base UI Selects narrows the list by offer, curve, title
    type, remuneration kind, and calculation status, with "Limpar filtros".
    The offer and curve choices come from the options query the workspace
    already caches; an offer or curve no longer listed shows as "Oferta
    excluída" or "Curva excluída". There is no index filter: the remuneration
    kind fixes the index. Offers that cannot be calculated yet stay
    selectable, and "Calculada" notes that it includes outdated results.
    Below 640px the filters collapse behind "Filtros (N)", N counting the
    active ones.
  - A status line above the list states the total ("N simulações", or "N
    simulações encontradas" when filtered) and "Atualizando simulações…"
    while a newer page or filter loads, during which the previous rows stay
    dimmed. Clearing the filters moves focus to it.
  - The filters live in the URL under the API's names (`offerId`, `curveId`,
    `titleType`, `remunerationKind`, `calculationStatus`). Changing one
    resets to page 1, and an invalid value is dropped by navigating with
    `replace`. The list's parameters carry to a simulation's page and back
    to the list, including after deleting it.
  - A filtered list with no rows says "Nenhuma simulação corresponde aos
    filtros." with "Limpar filtros", distinct from having no simulations. Each row shows the offer
    (name and issuer, or "Sem emissor"), the remuneration, the curve
    when indexed, the principal, the period, the net value of the last
    successful result, and a textual status tag unless the result is up to date
    ("Calculando", "Requer ação", "Falha técnica"). Desktop
    uses a table with fixed column widths; below 1024px, labeled rows. The whole row or card opens the
    simulation: one link per entry, stretched over the table row on desktop.
- `/simulacoes/nova` and `/simulacoes/:id` show the inputs beside the results
  (stacked below 1024px):
  - "Oferta": chosen from the offers visible to the user (system and own)
    grouped by title type and origin ("CDB · Do sistema", "CDB · Minhas"),
    with the title type hinted with its income-tax treatment and minimum term
    from the options query. "Duplicar e ajustar" opens the offer's terms as an
    editable copy that becomes a private offer; "Digitar termos" creates a
    private offer (title type, optional issuer, name, terms). Either is created
    together with the simulation when it is saved. The user's own chosen offer
    can also be edited in place, with the offer editor's impact notice; a
    system offer offers only "Duplicar e ajustar".
    Changing the remuneration kind clears the rate and the curve. Liquidity
    defaults to "No vencimento".
  - "Investimento": principal, investment date, and the curve for indexed
    kinds. The curve list is filtered by the offer's index and grouped by
    origin ("Do sistema", "Minhas"), auto-selects a sole curve, shows its
    coverage, and warns when the period may exceed it.
- The investment and maturity date pickers grey out weekends and holidays.
  `BusinessDateField` (in the library's `business-calendar/` folder, for any
  screen that needs business days) uses the shared business calendar (see
  Business rules and the business calendar) and limits its calendar to the
  accepted years; the browser holds no holiday rules. Typed dates are not blocked by the picker; the form rejects one outside
  the accepted years, and the request a non-business day, on its field. The INVALID notice for missing curve values
  links to the curve ("Ver curva <nome>").
- "Salvar e calcular" sends the simulation (with its revision when editing) and
  is disabled when nothing changed. A rejected request saves nothing: the form
  keeps its edits as unsaved changes and the reason appears on the responsible
  field (principal, non-business day, minimum term, index, missing offer
  or curve). A revision conflict says the simulation changed elsewhere and
  offers to reload. An accepted new simulation opens its own page, already
  waiting for its calculation.
- Status: the results panel always shows the calculation status and its
  cause in a live region ("Calculando · a curva CDI otimista foi alterada").
  The simulation's page polls its details query about every 3 seconds
  whatever the status, so finished calculations, edits from another tab, and
  premise changes all appear without special cases; TanStack Query pauses it
  while the tab is hidden and refetches on focus. A refetch updates the status
  and result panels, never the form: the editor is keyed by the simulation and
  each reload, not by revision, and saves with the revision it was loaded or
  last saved at (`PATCH` answers the new one). A poll showing a newer revision
  offers "Recarregar". The monthly balances
  query includes the result's `calculatedAt` in its key, so it refetches once
  per new result and never on an ordinary poll. Until the status is up to
  date, the panel shows the last successful result marked as predating the
  changes; a simulation that never succeeded shows only the status.
  - "Requer ação" shows the reason with its recovery: choose another curve
    or offer when one was deleted ("Sem curva, escolha outra", "Sem
    oferta, escolha outra"), or fix the field. A coverage gap names the first
    gap the API reports ("A curva não tem valores entre 02/01/2029 e
    28/12/2029 e em mais 2 períodos"); the domain groups consecutive missing
    rate references into ranges and the browser only phrases them.
  - "Falha técnica" explains that the automatic retries were exhausted and
    offers "Tentar novamente", which queues the calculation again.
- Results: the net value at maturity, then principal, gross balance, gross
  earnings, IOF, income tax, total taxes and net value, with the dates,
  business days, calculation instant in São Paulo time and the methodology
  version. "Evolução do saldo" is a disclosure.
- "Evolução do saldo" opens with an area chart of each month's closing gross
  balance (compact BRL axis; the tooltip shows the exact closing balance and
  accumulated earnings), then lists one row per month (business days, the
  month's earnings, accumulated earnings and the closing gross balance). Each
  month's button (`aria-expanded`) reveals that month's business days beneath
  it.
- Taxes: the IOF and income-tax rows name the applied rate ("IOF · isento pelo
  prazo", "Imposto de renda · 22,5%", or "Imposto de renda · isento" for LCI
  and LCA, whose dialog section explains the exemption without a bracket
  table). "Como os tributos foram calculados" (with an info icon) opens a short
  Base UI Dialog: the holding period, then for IOF and income tax one sentence
  on the rule, the formula string the API writes from the result's recorded
  values (shown as is), and the table with the applied row marked "seu caso"
  (not by color alone). Rates and tables come from the API, which takes them
  from the domain; the browser only finds the applied row by rate.
- A saved simulation's header offers "Nova simulação" (a blank form at
  `/simulacoes/nova`), "Duplicar" and "Excluir".
- "Duplicar" opens `/simulacoes/nova?a-partir-de=:id` prefilled with the same
  offer, curve and investment, for side-by-side comparison. "Excluir"
  confirms in an AlertDialog and says the deletion is permanent. Unsaved edits
  are guarded by `useBlocker` and `beforeunload`.
- Rentabilidade (monthly, annualized, total) and "prazo restante" are not
  shown yet; their definition is a pending product decision.
- Reads are screen-oriented (Backend for Frontend): the options query (title
  types, remuneration kinds with their index, visible offers with their origin
  and calculability, visible curves with their origin and
  coverage), the workspace query (the simulation's references and
  investment, its status with any reason, and the last successful result with
  the inputs it was computed from), and the monthly balances of the current
  result. The list has its own query. Writes create (optionally with a new
  private offer), edit with the revision, delete, and retry a
  failed calculation.

## Offer behavior

Recorded 2026-10-11 and implemented under `/ofertas` (D5). An offer has a title type
(fixed after creation), a name, an optional issuer, remuneration and rate,
maturity, liquidity, an owner, and a revision. User content is private and
editable; system content is visible to everyone and read only. Offers are
independent; the screens group them, and no grouping is stored.

- Routes under `/ofertas`: list, details, create, and editor. Each loads
  lazily. Confirmation dialogs load on demand.
- The list shows the offers visible to the user grouped by title type and
  origin ("Do sistema", "Minhas"), each with its name, issuer, and terms.
  Filters are the `q` (name or issuer), `titleType`, `origin` ("Do
  sistema" or "Minhas"), and `page` URL parameters. A submitted search or a
  changed filter resets to page 1. These
  parameters carry through to detail and editor links and back to the list.
  The page size is fixed at 20. Obsolete reads are canceled. A stale page
  beyond the last page is corrected through navigation.
- Details show the offer's exact terms in a definition list. Own offers offer
  "Editar", "Duplicar" and "Excluir"; system offers offer "Duplicar", which
  creates a private copy. A missing or deleted record has its own state.
- "Simulações com esta oferta" on the details lists the first 20 of the
  user's simulations that use it, each opening `/simulacoes/:simulationId`,
  then "Ver todas (N)" to `/simulacoes?offerId=<id>`. It reads the filtered
  simulation list (first page, 20 per page, the same read as that link's
  first page), whose total is the N used by the delete dialog and the editor
  notice, and it has its own loading, empty, and failure states with retry.
- Deleting confirms in an AlertDialog that states the deletion is permanent and
  that "N simulações ficarão sem oferta (Sem oferta, escolha outra)".
- The editor initializes from one snapshot. The title type is displayed as
  fixed information. Changing the remuneration kind clears the rate, because
  its unit changed. Before saving, it states how many of the user's
  simulations use the offer. Until offer changes recalculate them (D4b,
  paused), the notice reads "N simulações usam esta oferta e ficarão
  desatualizadas até serem salvas novamente"; it is hidden when none do.
  A system offer has no editor; its details offer only "Duplicar". The PATCH sends the edited revision and
  only changed fields. A revision conflict says the offer changed elsewhere
  and keeps the user's input until they reload. A successful save clears the
  dirty baseline before redirecting to a fresh detail read. A failed detail
  read after save is a read failure, not permission to repeat the write.
- Pure helpers shift decimal strings to convert percentages and fractions. They
  reject zero, invalid input, and values outside Decimal(65,30) storage.
  Calendar validation and `dd/mm/aaaa` display never construct local-time
  instants.
- Browser and API verification uses dedicated test offers. It doesn't reset
  local databases or change Keycloak accounts.

## Business rules and the business calendar

Decision dated 2026-10-13. The API keeps the final say over every business
rule, because other clients, the seed, and imports write through it. A form
repeats a small rule set only for instant feedback, with the API's messages,
and still shows the API's answer when they disagree. Editing conveniences
that are not rules, such as keeping curve rows contiguous, live only in the
frontend as pure, tested functions. Browser code never imports server
libraries.

The business calendar stays in the API, the only source of holidays
(decision 2026-10-14). The page accepts dates within the current year ± 100
(`acceptedYears`, a limit of the page alone, since its calendars and checks
cannot cover every year; the API accepts any date).
`GET business-calendar?fromYear=&toYear=` returns the holidays that fall on
weekdays in those years; the browser treats Saturday and Sunday as
non-business. Date fields outside the curve editor (offer maturity,
simulation investment date) reject typed dates outside those years with the
same message. The app starts this read right after login
(`prefetchInvestmentSimulator`), it lasts the session, and
`useBusinessCalendar()` turns it into a synchronous `BusinessCalendar`: no
screen reasons about years being loaded. Screens that need it (the curve
editor) wait for it with their own loading and retry states, and every
business date field bounds its picker to the accepted years.

## Curve behavior

Recorded 2026-10-11 and implemented under `/curvas` (D6). A curve has an
index (which fixes the value convention), a name, an optional description,
intervals with values, an owner, and a revision. Alternatives of one index are
separate curves; screens group them by index and origin, and nothing about the
grouping is stored. Visibility and ownership follow Offer behavior.

- Routes under `/curvas`: list, curve details, create, and editor. Each loads
  lazily. Confirmation dialogs load on demand.
- The list shows the curves visible to the user grouped by index, then by
  origin ("Do sistema", "Minhas"), sorted by name, with each curve's coverage
  (first and last dates; a curve has no gaps). The `index` URL parameter
  filters it and carries through to detail and editor links and back; an
  unknown value is dropped through navigation. The list is not paginated.
  "Nova curva" from a filtered list starts with that index.
- Details show the index, convention, coverage, origin, and description, a
  step line chart of the values over time above the intervals table (each step
  runs until the next interval starts, a zero
  line appears when a value is negative, and the hovered interval's exact value
  and dates show in a strip above the plot, never over the axis, for mouse and
  keyboard alike), and "Simulações com esta curva" with the same reads,
  states, and "Ver todas (N)" link (`/simulacoes?curveId=<id>`) as offers.
  Own curves offer "Editar", "Duplicar" and "Excluir". A system curve shows a
  "Curva do sistema: somente leitura" notice and offers only "Duplicar", as
  its primary action. "Duplicar" creates a private copy named "<nome>
  (cópia)" with the same index and content.
- The editor edits the name, description, and intervals; the index is chosen
  only on creation, where it starts unselected (or with the list's `index`
  filter) and the rows appear once it is chosen. Creating also offers "Copiar
  intervalos de": a base curve, filtered by the chosen index, whose choice
  sets the index and replaces the rows. Intervals are an editable row table
  (decision 2026-10-13): one row per interval with start, end, and value, all
  inclusive. CDI and SELIC rows take dates, whose pickers offer only business
  days within the row's limits: an end picker opens on its start's month and
  offers nothing before the start (a one-day interval stays possible) or
  from the next row's end on, and a start picker offers nothing up to the
  previous row's start or after its own end (typed dates are not blocked;
  changing a start checks a filled end at once), and an annual rate in percent, never
  negative; IPCA rows take MM/AAAA months (first to last day) and a monthly
  variation in percent above -100%, which may be negative. Switching between
  daily and monthly indexes on creation clears the rows.
- Rows stay contiguous as they are edited (pure row operations in
  `curve-form.ts`, tested without React):
  - Changing an end moves the next row's start to the following business day
    (or month); changing a start moves the previous row's end to the business
    day (or month) before it.
  - Removing a row between two others makes the previous one run until the
    next starts. Removing the first or last row shortens the curve, never
    stretching a neighbor over the removed days.
  - "Dividir em dois" splits a row at the month start nearest its middle (its
    middle business day, or month, when it lies within one month); both
    halves keep the value and the second one's value gets focus.
  - "Adicionar intervalo" starts the new row right after the last one and
    guesses its end as that month's last business day (or the same month),
    focusing the value. A value field suggests the previous row's value as
    its placeholder.
  - Removing a row, switching between daily and monthly indexes with rows
    filled, or copying a base curve over typed rows offers "Desfazer", right
    under the rows, until the next edit or save. Removing moves focus to
    "Desfazer"; undoing moves it to the restored row.
  - After rows are added, split, removed, or restored, only the rules between
    rows and the fields already in error are re-checked, so a new row's empty
    fields stay quiet until the next save.
  - Overlaps and missing business days (or months) are flagged on the later
    row with the API's message and a one-click "Começar em <data>" fix. Typing
    alone cannot open a gap, since rows follow each other; the message and fix
    are for rows loaded with one, or a gap the API reports. A
    typed weekend or holiday shows "Não é dia útil." without blocking. At
    least one row is required. A live summary states the coverage (months for IPCA). On phones each row has
    a visible "Intervalo N" heading and its actions show their names. Observed
    and projected values are not distinguished yet (open question in the
    curve specification).
- The editor follows the offer editor's impact notice, revision conflict, and
  save rules. Until curve changes recalculate simulations (D4b, paused), the
  notice reads "N simulações usam esta curva e ficarão desatualizadas até
  serem salvas novamente". The PATCH sends only changed fields, comparing
  intervals after the same conversion and ordering, so retyping a value
  identically changes nothing.
- Deleting a curve states how many of the user's simulations will require a
  new choice ("Sem curva, escolha outra"). Its copies are not affected.
