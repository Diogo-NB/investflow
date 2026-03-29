# Portfolio Domain — Reference

## Overview

Portfolio is a **read model / CQRS projection**. It has no aggregates, no business rules, and no write operations beyond updating projection state. It is a supporting subdomain entirely driven by events from the Investments context.

## Projection: PortfolioPosition

One row per `(ownerId, ownerType, investmentType)` combination.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Row identifier |
| `ownerId` | UUID | User or organization ID |
| `ownerType` | `USER \| ORGANIZATION` | Scope type |
| `investmentType` | `SELIC \| CDI \| IPCA` | Investment type |
| `totalInvested` | Decimal | Sum of all `appliedAmount` across active+matured applications |
| `currentValue` | Decimal | Consolidated current value (sum of all currentValue) |
| `activeCount` | Integer | Number of ACTIVE applications in this bucket |
| `lastUpdatedAt` | Date | Timestamp of last projection update |

## Event → Projection Mapping

| Event | Projection Update |
|---|---|
| `ApplicationCreatedEvent` | Upsert: `totalInvested += appliedAmount`, `currentValue += appliedAmount`, `activeCount += 1` |
| `ApplicationValueUpdatedEvent` | Update: `currentValue` adjusted by delta (newValue - previousValue) |
| `ApplicationMaturedEvent` | Update: `activeCount -= 1`, `currentValue` set to finalValue for this application |
| `ApplicationRedeemedEvent` | Update: `totalInvested -= appliedAmount`, `currentValue -= redeemedValue`, `activeCount` unchanged (already matured) |

## UC-08: Update Consolidated Position

Consumer flow:
1. Consumer receives Application event
2. Upsert `portfolio_positions` row for matching `(ownerId, ownerType, investmentType)`
3. Commit transaction

## Access Patterns

- `INVESTOR`: queries positions filtered by `ownerId = userId AND ownerType = USER`
- `ORG_USER`: queries positions filtered by `ownerId = organizationId AND ownerType = ORGANIZATION`
