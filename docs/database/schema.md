# Database Schema

PostgreSQL. Logical multi-tenancy via `organizationId` column — no physical schema separation.

---

## Infrastructure Tables

### market_rates

Written daily by an external Lambda. The system assumes current rates are always available.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Row identifier |
| `indexer` | VARCHAR | `SELIC \| CDI \| IPCA` |
| `value` | DECIMAL(10,6) | Rate value |
| `reference_date` | DATE | Date this rate applies to |
| `created_at` | TIMESTAMPTZ | When Lambda inserted this row |

Index: `(indexer, reference_date DESC)` for fetching the latest rate by type.

---

## Domain Tables

### investment_products

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `ProductId` |
| `organization_id` | UUID | Multi-tenancy scope |
| `name` | VARCHAR | — |
| `type` | VARCHAR | `SELIC \| CDI \| IPCA` |
| `indexer` | JSONB | Indexer VO serialized |
| `rate_value` | DECIMAL | — |
| `rate_reference_type` | VARCHAR | `PERCENTAGE_CDI \| FIXED \| IPCA_PLUS` |
| `period_start_date` | DATE | — |
| `period_end_date` | DATE | — |
| `minimum_amount` | DECIMAL | — |
| `total_volume` | DECIMAL | — |
| `allocated_volume` | DECIMAL | Default 0 |
| `status` | VARCHAR | `DRAFT \| OPEN \| CLOSED` |
| `created_at` | TIMESTAMPTZ | — |

### orders

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `OrderId` |
| `investor_id` | UUID | Multi-tenancy scope (INVESTOR) |
| `product_id` | UUID (FK) | References `investment_products` |
| `organization_id` | UUID | Multi-tenancy scope (ORG_USER) |
| `amount` | DECIMAL | — |
| `status` | VARCHAR | `PENDING \| ANALYZING \| APPROVED \| REJECTED \| EXPIRED` |
| `expires_at` | TIMESTAMPTZ | For scheduler queries |
| `rejection_reason` | TEXT (nullable) | — |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

Index: `(status, expires_at)` for scheduler expiration queries.

### applications

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | `ApplicationId` |
| `order_id` | UUID (FK) | References `orders` |
| `investor_id` | UUID | Multi-tenancy scope (INVESTOR) |
| `product_id` | UUID (FK) | References `investment_products` |
| `organization_id` | UUID | Multi-tenancy scope (ORG_USER) |
| `type` | VARCHAR | `SELIC \| CDI \| IPCA` |
| `applied_amount` | DECIMAL | Immutable after creation |
| `current_value` | DECIMAL | Updated by scheduler/events |
| `rate_value` | DECIMAL | Snapshot from product |
| `rate_reference_type` | VARCHAR | Snapshot from product |
| `period_start_date` | DATE | — |
| `period_end_date` | DATE | For scheduler queries |
| `status` | VARCHAR | `ACTIVE \| MATURED \| REDEEMED` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

Index: `(status, period_end_date)` for maturation scheduler queries.

### portfolio_positions

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | — |
| `owner_id` | UUID | `userId` or `organizationId` |
| `owner_type` | VARCHAR | `USER \| ORGANIZATION` |
| `investment_type` | VARCHAR | `SELIC \| CDI \| IPCA` |
| `total_invested` | DECIMAL | — |
| `current_value` | DECIMAL | — |
| `active_count` | INTEGER | — |
| `last_updated_at` | TIMESTAMPTZ | — |

Unique constraint: `(owner_id, owner_type, investment_type)`.
