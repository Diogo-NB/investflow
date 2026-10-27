# Frontend Patterns

Frontend decisions, the pinned stack, the app's structure and composition
contract, configuration, and verification. The coding rules (components,
state, data, routing, forms, styling, accessibility, tests) are owned by
`investflow-react`, with browser authentication in its
`references/authentication.md`.

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
   and asynchronous recalculation, see `recalculation.md`): done are the
   offer screens under `/ofertas` (D5) and the curve screens under `/curvas`
   (D6), mounted by the same route factory. Next is the rest of the
   simulation workspace's recorded behavior (impact notices, editing an own
   offer in place).
4. Finally: full verification (see Testing and verification).

Each step keeps `pnpm check` green. The Keycloak realm doesn't change; API
additions are recorded with the feature that needs them. Build features from
the recorded behavior in `docs/product/screens/` (`app-shell.md`,
`simulations.md`, `offers.md`, `curves.md`) and design them as
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

Unit tests follow the state-first policy in `investflow-react`.

Typecheck, lint, builds, and browser checks validate presentation. The
commands a frontend change runs before it is done are in "Done means" in
`AGENTS.md`. In the browser, check local Keycloak login, reload, logout,
failure/retry, keyboard focus, responsive reflow (320–1440px, 200% zoom),
reduced motion, and axe A/AA. Add an E2E project only for a demonstrated
critical product journey. The workspace includes none.

The baseline excludes SSR and RSC, React Router Framework mode, service
workers, micro-frontends, OpenAPI generation, a global state library, and a
separate design-system library. Introducing one requires a concrete need and
approval of the architecture change.

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
