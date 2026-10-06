# Investment Simulator Web

Angular presentation for the Investment Simulator bounded context. The app
imports `investmentSimulatorRoutes` from `@investflow/investment-simulator-web`
and mounts it at `/ofertas`. No components, stores, or transport types are public.

Offer source is feature-first: route pages and signal state in `offers/feature`,
HTTP adapters in `offers/api`, browser-owned types in `offers/models`, and pure
calendar/decimal helpers in `offers/utils`. The reusable form and confirmation
dialogs live in `offers/ui`. Native Signal Forms and httpResource remain
experimental on the installed Angular 21 major under the existing adoption
approval. Material controls use the app's global tokens and theme.

`PaginatedResult<Item>` lives in `src/lib/pagination/paginated-result.type.ts`
and is imported locally by browser API adapters. It has the same wire shape as
the independent backend interface in `@investflow/shared-types`. InvestFlow has
a single frontend app: keep shared browser code inside the owning web project,
without extracting reusable frontend Nx libraries or exporting internal types.

Authentication belongs to the app. This library uses relative `/api` requests,
with bearer interception supplied by the parent injector. It makes no Keycloak
calls and stores no tokens. Offers are a shared catalog. Creation requires an
existing issuer; editing preserves issuer/title identity; deletion is soft.

```sh
pnpm nx run investment-simulator-web:lint
pnpm nx test investment-simulator-web
pnpm nx build investment-simulator-web
pnpm test:web
```

Tests cover state and orchestration without rendering templates. Validate the
screens through browser checks, including errors, pending writes, keyboard,
responsive reflow, and unsaved navigation. Keep dependency versions unchanged.

See [frontend patterns](../../../docs/architecture/frontend-patterns.md),
[design tokens](../../../DESIGN.md), and
[HTTP contracts](../infrastructure/README.md).
