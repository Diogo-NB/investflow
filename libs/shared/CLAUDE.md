# Shared Kernel

Contains only genuinely transversal code used by **more than one bounded context**.

## Rule: What Belongs Here

If a type, class, or utility is used by only one bounded context, it belongs in that context — not here.

## Value Objects (shared/domain)

| Value Object | Fields | Validation |
|---|---|---|
| `Money` | `amount: Decimal`, `currency: 'BRL'` | `amount > 0` |
| `Rate` | `value: Decimal`, `referenceType: ReferenceType` | `value > 0` |
| `InvestmentType` | enum: `SELIC \| CDI \| IPCA` | — |
| `Owner` | `ownerId: UUID`, `ownerType: OwnerType` | ORG_USER requires `organizationId` |

`ReferenceType` enum: `PERCENTAGE_CDI | FIXED | IPCA_PLUS`

`OwnerType` enum: `USER | ORGANIZATION`

## Infrastructure (shared/infrastructure)

| Component | Responsibility |
|---|---|
| `JwtAuthGuard` | Global NestJS guard — validates Keycloak JWT on every request |
| `MessageConsumerBase` | Abstract base class for async consumers (retry, DLQ) — concrete impl TBD |
| `DatabaseConfig` | TypeORM / DB connection configuration |

## Types (shared/types)

Public DTOs and contract interfaces shared between bounded contexts. These are the only types Portfolio may use from the Investments domain (re-exported here).
