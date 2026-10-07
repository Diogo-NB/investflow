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

## Offer HTTP API

All routes below require the existing JWT guard. The catalog is shared by
authenticated clients; there is no per-user offer ownership or new role model.

| Method | Path under `/api/investment-simulator` | Response                           |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/offers`                              | `{ items, total, page, pageSize }` |
| GET    | `/offers/:offerId`                     | Offer details                      |
| GET    | `/issuers`                             | `{ id, name }[]`                   |
| POST   | `/offers`                              | 201 `{ id }`                       |
| PATCH  | `/offers/:offerId`                     | 204, no body                       |
| DELETE | `/offers/:offerId`                     | 204, no body                       |

List accepts `page` (default 1), `pageSize` (default 20, maximum 100), `q`
(trimmed, case-insensitive issuer-name substring, maximum 100 characters), and
`titleType` (CDB/LCI/LCA). Filters combine with AND. Page is bounded to 21474836
to keep database offsets within the signed integer range for every allowed page
size. Invalid query/UUID input returns 400. An out-of-range valid page returns an
empty array and the matching total. Sort is maturity ascending, then ID ascending.
Issuer sort is name ascending, then ID ascending, including issuers with no offers.

The list handler's output uses `PaginatedResult<Item>` imported from
`@investflow/shared-types`. The frontend uses an independently declared
`PaginatedResult<Item>` in its web project's local `src/lib/pagination` folder
with the same wire shape and its own offer item type.

List entries and details have this shape:

```json
{
  "id": "offer UUID",
  "titleType": "CDB",
  "issuer": { "id": "issuer UUID", "name": "Banco Local" },
  "maturityDate": "2028-12-31",
  "redemptionTerms": { "kind": "DAILY" },
  "remunerationTerms": { "kind": "CDI_PERCENTAGE", "rate": "1.1" }
}
```

Dates are calendar strings, and rates are exact decimal fractions without
scientific notation: `1.1` is 110% of CDI; `0.12` is 12% annually. No persistence
timestamps/deletion fields or ORM values escape the query handlers. Offer reads and
counts exclude soft-deleted records; missing/deleted details return 404 with
`OFFER_NOT_FOUND`. Infrastructure read failures return 500 with
`OFFER_QUERY_FAILED` or `ISSUER_QUERY_FAILED` through the existing error envelope.

Read handlers query Prisma directly and do not load aggregates or extend command
repository ports. Their GET methods skip the global command transaction. Results
are unwrapped by the existing global interceptor; no success envelope is added.

Each handler owns its explicit output contract and any private `toOutput()`
mapping in its query-handler file: `GetOfferOutput`,
`ListOffersOutput`/`OfferListItem`, and `ListIssuersOutput`/`IssuerListItem`.
Offer handlers serialize calendar dates and decimal rates while mapping records
inside `Result.fromPromise()`. The issuer selection already matches its output
and needs no mapper. Controllers return these Results directly. List and detail
contracts can evolve independently; a presenter is only needed for a distinct
transport representation. Command-side persistence mappers remain unchanged.

Creation takes `titleType`, `issuerId`, `maturityDate`, `redemptionTerms`, and
`remunerationTerms`, and requires an existing issuer. PATCH takes optional
`maturityDate`, `redemptionTerms`, and `remunerationTerms`; it rejects changes to
`titleType` and `issuerId`. DELETE retains the existing clock-driven soft deletion.
No new business restrictions, schema migrations, or identity changes are required.

## Building

Run `pnpm nx build investment-simulator-infrastructure` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-infrastructure` to execute its Jest
tests.
