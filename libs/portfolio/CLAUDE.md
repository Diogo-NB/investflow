# Portfolio Bounded Context

Supporting subdomain. **Read model only — no aggregates, no business logic.**

Portfolio is a CQRS projection that consumes events from the Investments context and maintains a materialized view in PostgreSQL.

## Critical Rule

**Never import from `investments/*`.** Portfolio receives data exclusively via events. Any need to share a type must go through `shared/types`.

## Projection: PortfolioPosition

One row per (owner, investmentType) combination.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Identifier |
| `ownerId` | UUID | User or organization |
| `ownerType` | `USER \| ORGANIZATION` | Scope type |
| `investmentType` | `SELIC \| CDI \| IPCA` | Investment type |
| `totalInvested` | Decimal | Sum of all `appliedAmount` values |
| `currentValue` | Decimal | Consolidated updated value |
| `activeCount` | Integer | Number of ACTIVE applications |
| `lastUpdatedAt` | Date | Timestamp of last projection update |

## Events Consumed

| Event | Effect on PortfolioPosition |
|---|---|
| `ApplicationCreatedEvent` | Upsert position: increment `totalInvested`, `currentValue`, `activeCount` |
| `ApplicationValueUpdatedEvent` | Update `currentValue` for the matching application |
| `ApplicationMaturedEvent` | Decrement `activeCount`, update `currentValue` to final value |
| `ApplicationRedeemedEvent` | Decrement `totalInvested` and `currentValue`, remove from active count |

