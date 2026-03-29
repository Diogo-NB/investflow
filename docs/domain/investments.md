# Investments Domain — Reference

## Aggregate: InvestmentProduct

### Fields

| Field | Type | DDD Classification | Description |
|---|---|---|---|
| `id` | `ProductId` (UUID) | Identity | Unique product identifier |
| `organizationId` | `OrganizationId` (UUID) | Identity | Issuing organization |
| `name` | `string` | Primitive | Commercial name |
| `type` | `InvestmentType` | Value Object | `SELIC \| CDI \| IPCA` |
| `indexer` | `Indexer` | Value Object | Indexer + config (e.g. 110% CDI, IPCA + 5.5%) |
| `rate` | `Rate` | Value Object | Contracted rate |
| `period` | `ProductPeriod` | Value Object | `startDate + endDate` |
| `minimumAmount` | `Money` | Value Object | Minimum investment amount (PU mínimo) |
| `totalVolume` | `Money` | Value Object | Maximum captation volume |
| `allocatedVolume` | `Money` | Value Object | Currently reserved/applied volume |
| `status` | `ProductStatus` | Value Object | `DRAFT \| OPEN \| CLOSED` |
| `createdAt` | `Date` | Metadata | Creation timestamp |

### State Machine

```
DRAFT → OPEN → CLOSED
```

### Invariants

1. `allocatedVolume <= totalVolume` at all times
2. Only `OPEN` products accept new Orders
3. `minimumAmount.amount > 0`
4. `period.endDate > period.startDate`
5. `type` and `indexer` must be compatible (SELIC uses FIXED rate, CDI uses PERCENTAGE_CDI, IPCA uses IPCA_PLUS)

---

## Aggregate: Order

### Fields

| Field | Type | DDD Classification | Description |
|---|---|---|---|
| `id` | `OrderId` (UUID) | Identity | Unique order identifier |
| `investorId` | `UserId` (UUID) | Identity | Investor who created the order |
| `productId` | `ProductId` (UUID) | Reference | Product being ordered |
| `amount` | `Money` | Value Object | Amount investor wants to invest |
| `status` | `OrderStatus` | Value Object | `PENDING \| ANALYZING \| APPROVED \| REJECTED \| EXPIRED` |
| `expiresAt` | `Date` | Primitive | Expiration timestamp (org-configurable, default 2 days) |
| `rejectionReason` | `string \| null` | Primitive | Rejection reason (nullable) |
| `createdAt` | `Date` | Metadata | Creation timestamp |
| `updatedAt` | `Date` | Metadata | Last update timestamp |

### State Machine

```
PENDING → ANALYZING → APPROVED
                    → REJECTED
PENDING  → EXPIRED
ANALYZING → EXPIRED
```

### Invariants

1. `amount >= product.minimumAmount` at creation
2. Product must be `OPEN` at creation
3. Status transitions are unidirectional
4. Only `PENDING` or `ANALYZING` orders can expire
5. `expiresAt` is computed at creation time

---

## Aggregate: Application

### Fields

| Field | Type | DDD Classification | Description |
|---|---|---|---|
| `id` | `ApplicationId` (UUID) | Identity | Unique application identifier |
| `orderId` | `OrderId` (UUID) | Reference | Originating order |
| `investorId` | `UserId` (UUID) | Identity | Position owner |
| `productId` | `ProductId` (UUID) | Reference | Investment product |
| `organizationId` | `OrganizationId` (UUID) | Identity | Issuing organization |
| `type` | `InvestmentType` | Value Object | `SELIC \| CDI \| IPCA` |
| `appliedAmount` | `Money` | Value Object | Amount effectively invested (immutable) |
| `currentValue` | `Money` | Value Object | Updated calculated value |
| `rate` | `Rate` | Value Object | Contracted rate — snapshot from Product (immutable) |
| `period` | `ApplicationPeriod` | Value Object | `startDate + endDate` |
| `status` | `ApplicationStatus` | Value Object | `ACTIVE \| MATURED \| REDEEMED` |
| `createdAt` | `Date` | Metadata | Creation timestamp |
| `updatedAt` | `Date` | Metadata | Last update timestamp |

### State Machine

```
ACTIVE → MATURED → REDEEMED
```

### Invariants

1. `appliedAmount` is immutable after creation
2. `rate` is immutable after creation
3. Only `ACTIVE` applications receive `updateValue()` calls
4. Only `MATURED` applications can be redeemed
5. `period.endDate > period.startDate`

---

## Domain Services

### InvestmentCalculationService

Calculates the updated value of an Application based on its type and current market rates.

Strategy pattern implementations:

| Strategy | Formula |
|---|---|
| `SelicCalculationStrategy` | `PU = PU_emissão × (1 + taxa_selic)^(DU/252)` |
| `CdiCalculationStrategy` | `PU = PU_emissão × (1 + %CDI × taxa_cdi)^(DU/252)` |
| `IpcaCalculationStrategy` | `PU = PU_emissão × (1 + IPCA) × (1 + spread)^(DU/252)` |

Reads `market_rates` table for current rate values. Assumes rates are always available (Lambda updates daily).

### InvestmentMaturationService

Scheduler-invoked. Queries ACTIVE applications where `endDate <= now()`. For each:
1. `InvestmentCalculationService.calculateFinalValue(application)`
2. `application.mature(finalValue)`
3. Persist + dispatch `ApplicationMaturedEvent`

### OrderExpirationService

Scheduler-invoked. Queries PENDING/ANALYZING orders where `expiresAt <= now()`. For each:
1. `order.expire()`
2. `product.releaseVolume(order.amount)`
3. Persist + dispatch `OrderExpiredEvent`

### RiskAnalysisService (Port)

Interface in application layer. Mock implementation simulates compliance with configurable latency.
Returns: `{ decision: 'APPROVED' | 'REJECTED', reason?: string }`
