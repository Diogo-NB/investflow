# Investment Simulator Infrastructure

NestJS adapters and context-local composition for the Investment Simulator
bounded context. This project owns controllers, DTOs, optional presenters, query
handlers, Prisma repositories, mappers, listeners, and provider bindings.

`InvestmentSimulatorInfrastructureModule` is the public composition module used
by the current modular-monolith API. If future service or Lambda hosts require
different adapter sets, expose focused HTTP, messaging, persistence, or
background-work modules from this project rather than activating unrelated
adapters as import side effects.

Consumers import its public API through
`@investflow/investment-simulator-infrastructure`.

Source is organized by plural business feature. Each feature groups adapters
by boundary: for example, offer controllers, request DTOs, and HTTP validators
live in `src/lib/offers/http`, while Prisma repositories and mappers live in
`src/lib/offers/persistence`.

## HTTP API

Every route lives under `/api/investment-simulator` and requires the JWT
guard; it acts as the authenticated user, read from the token. The full input
and output contracts are the request DTOs in each feature's `http/requests`
folder and the output types in its query-handler files. This section covers
the rules those contracts don't show.

Conventions shared by every route:

- Calendar dates are `YYYY-MM-DD` strings. Decimals are exact strings without
  scientific notation. Rates and returns are fractions: `0.12` is 12% a year,
  and `1.1` is 110% of an index.
- Successful responses carry no envelope; the global interceptor unwraps
  query and use-case Results. Errors use the shared envelope (`statusCode`,
  `code`, pt-BR `message`, `details`). Invalid input answers 400
  `REQUEST_INVALID` listing `details.fields`.
- Edits send the `revision` they were based on and answer 409
  `*_REVISION_CONFLICT` when it is stale.
- GET routes skip the global command transaction. Read handlers query Prisma
  directly, without loading aggregates.

### Offers and curves

Both features have the same model. A record is either private to its owner or
belongs to the system: `origin` is `SYSTEM` or `OWN`. Users see system records
and their own. Editing or deleting a system record answers `*_READ_ONLY`.
Duplicating any visible record creates a private copy. Deletion is soft, and
a deleted record answers 404 `*_NOT_FOUND`.

| Method | Path                          | Response                           |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | `/offers`                     | `{ items, total, page, pageSize }` |
| GET    | `/offers/:offerId`            | the offer                          |
| POST   | `/offers`                     | 201 `{ offerId }`                  |
| PATCH  | `/offers/:offerId`            | 204                                |
| POST   | `/offers/:offerId/duplicates` | 201 `{ offerId }`                  |
| DELETE | `/offers/:offerId`            | 204                                |
| GET    | `/curves`                     | array of curve summaries           |
| GET    | `/curves/:curveId`            | the curve with its intervals       |
| POST   | `/curves`                     | 201 `{ curveId }`                  |
| PATCH  | `/curves/:curveId`            | 204                                |
| POST   | `/curves/:curveId/duplicates` | 201 `{ curveId }`                  |
| DELETE | `/curves/:curveId`            | 204                                |

The offer list takes:

- `page` (default 1, at most 21474836, which keeps offsets in range) and
  `pageSize` (default 20, at most 100);
- `q`, matching name or issuer case-insensitively;
- `titleType` and `origin`.

It is ordered by title type, system offers first, then name.
An offer's `titleType` cannot change, and PATCH rejects it. The curve list is
not paginated; it filters by `index` and is ordered by index, system curves
first, then name. Curve intervals must be contiguous over business days (or
months for IPCA), otherwise `CURVE_INTERVAL_GAP`. Every change writes an
identifier-only event to the outbox.

### Simulations

| Method | Path                                          | Response                           |
| ------ | --------------------------------------------- | ---------------------------------- |
| GET    | `/simulations`                                | `{ items, total, page, pageSize }` |
| POST   | `/simulations`                                | 201 `{ simulationId }`             |
| PATCH  | `/simulations/:simulationId`                  | 200 `{ revision }`                 |
| POST   | `/simulations/:simulationId/recalculate`      | 204                                |
| DELETE | `/simulations/:simulationId`                  | 204                                |
| GET    | `/simulations/:simulationId/monthly-balances` | `{ items }`, one per month         |
| GET    | `/simulation-options`                         | choices for the simulation form    |
| GET    | `/simulation-workspaces/:simulationId`        | the simulation page                |

Simulations belong to their owner only; another user's id answers 404
`SIMULATION_NOT_FOUND`.

**Creating and editing.**

- POST and PATCH take an `offer` and an `investment` (`principal`,
  `investmentDate`, `curveId`). PATCH also takes the `revision`.
- `offer` is either `{ id }` of a visible offer or `{ new }` with an offer's
  terms. A new offer is created in the same transaction, so a rejected request
  creates nothing.
- Every rule except curve coverage is checked on the request. The calculation
  is then stored `PENDING` and runs asynchronously; see
  [Event Flow](../../../docs/architecture/event-flow.md).
- `recalculate` queues a new calculation from the current premises in any
  status; the screens offer it after `FAILED`.

**List.**

- Filters: `offerId`, `curveId`, `titleType`, `remunerationKind` and
  `calculationStatus`, combined with AND. `page` and `pageSize` work as for
  offers.
- Order: newest first by default. With `sort=netAnnualReturn`, simulations
  are ordered by the last successful result's net annual return, descending;
  those without a result come last, newest first. Any other `sort` value
  answers 400.
- Each item carries its offer's terms, the calculation status, and `result`
  (`calculatedAt`, `outdated`, `netBalance`, `netAnnualReturn`) or null.

**Simulation page** (`GET /simulation-workspaces/:simulationId`):

- It returns the simulation and its investment, the offer and curve (also when
  deleted), the calculation status with its cause and reason, and
  `remainingTerm`.
- `remainingTerm` is computed from today's UTC date and the current dates, in
  any status. It has a `phase` (`NOT_STARTED`, `RUNNING` or `MATURED`) and the
  calendar days left, split into years, months and days. It is null without an
  offer.
- `result` is the last successful calculation, or null. It is `outdated` when
  the simulation, offer, curve or methodology changed since. Its shape:

```json
{
  "calculatedAt": "2026-10-17T01:24:58.123Z",
  "methodologyVersion": "cdb-252-v1",
  "outdated": false,
  "principal": "10000",
  "term": {
    "investmentDate": "2026-11-03",
    "maturityDate": "2028-12-29",
    "businessDays": 539,
    "calendarDays": 787
  },
  "gross": {
    "finalBalance": "13512.60946…",
    "earnings": "3512.60946…",
    "rateOfReturn": { "forPeriod": "0.35126…", "annual": "0.15113…", "monthly": "0.01179…" }
  },
  "net": {
    "finalBalance": "12985.71804…",
    "earnings": "2985.71804…",
    "rateOfReturn": { "forPeriod": "0.29857…", "annual": "0.12992…", "monthly": "0.01023…" }
  },
  "taxes": {
    "iof": { "base": "…", "rate": null, "amount": "0", "formula": "Isento: prazo de 30 dias ou mais" },
    "incomeTax": { "base": "…", "rate": "0.15", "amount": "526.89…", "formula": "R$ 3.512,61 × 15% = R$ 526,89" },
    "total": "526.89…"
  }
}
```

Field meanings:

- `gross` is before taxes and `net` after IOF and income tax.
- Annual returns spread the period's return over 252 business days.
- `monthly` is the equivalent constant monthly rate.
- A tax `rate` is null when the tax is exempt.
- `formula` is pt-BR text for display.

### Business calendar

`GET /business-calendar?fromYear=&toYear=` (years 1900 to 2200) answers the
weekday national holidays in that range. Browsers use it for their date
pickers; the last answer is cached.

## Persistence notes

`simulation_result` stores the result's amounts, taxes, and business days. It
also stores its rates of return as a read model for sorting and future
aggregation. The mapper writes them from the domain and never reads them back,
because the domain derives them from the balances and taxes.

## Building

Run `pnpm nx build investment-simulator-infrastructure` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-infrastructure` to execute its Jest
tests.
