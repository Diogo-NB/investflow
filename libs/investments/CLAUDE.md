# Investments Bounded Context

Core domain. Contains three aggregate roots with independent lifecycles.

## Aggregate: InvestmentProduct

Catalog entry managed by ORG_USER. Controls available volume.

**State machine:** `DRAFT → OPEN → CLOSED`

| Transition | Trigger | Guard |
|---|---|---|
| DRAFT → OPEN | `product.publish()` | All required fields populated |
| OPEN → CLOSED | `product.close()` or volume exhausted | — |

**Invariants:**
1. `allocatedVolume` must never exceed `totalVolume`
2. Only `OPEN` products accept new Orders
3. `minimumAmount` must be positive
4. `endDate` must be after `startDate`
5. `type` and `indexer` must be compatible (SELIC does not accept a CDI percentage rate)

**Methods:**
- `InvestmentProduct.create(props)` — factory, status = DRAFT
- `product.publish()` — DRAFT → OPEN
- `product.reserveVolume(amount: Money)` — increments allocatedVolume, throws if would exceed totalVolume
- `product.releaseVolume(amount: Money)` — decrements allocatedVolume (on order rejection/expiration)
- `product.close()` — OPEN → CLOSED

**Events raised:** `ProductPublishedEvent`, `ProductClosedEvent`

---

## Aggregate: Order

Investor's intent to invest. Holds reserved volume during its lifecycle.

**State machine:**
```
PENDING → ANALYZING → APPROVED
                    → REJECTED
PENDING  → EXPIRED
ANALYZING → EXPIRED
```

| Transition | Trigger | Side Effect |
|---|---|---|
| PENDING → ANALYZING | Async consumer starts risk analysis | — |
| ANALYZING → APPROVED | Risk analysis approved | Application is created |
| ANALYZING → REJECTED | Risk analysis rejected | `product.releaseVolume(amount)` |
| PENDING/ANALYZING → EXPIRED | Scheduler: `expiresAt <= now()` | `product.releaseVolume(amount)` |

**Invariants:**
1. `amount` must be >= `product.minimumAmount` at creation time
2. Product must be `OPEN` at creation time
3. Status transitions are unidirectional — no rollbacks
4. Only `PENDING` or `ANALYZING` orders can expire
5. `expiresAt` is computed at creation from org config (default: 2 days)

**Methods:**
- `Order.create(props, product)` — factory, validates against product, status = PENDING
- `order.startAnalysis()` — PENDING → ANALYZING
- `order.approve()` — ANALYZING → APPROVED
- `order.reject(reason: string)` — ANALYZING → REJECTED
- `order.expire()` — PENDING/ANALYZING → EXPIRED

**Events raised:** `OrderCreatedEvent`, `OrderAnalysisStartedEvent`, `OrderApprovedEvent`, `OrderRejectedEvent`, `OrderExpiredEvent`

---

## Aggregate: Application

The concretized investment position. Created automatically when an Order is approved.

**State machine:** `ACTIVE → MATURED → REDEEMED`

| Transition | Trigger | Side Effect |
|---|---|---|
| ACTIVE → MATURED | Scheduler: `endDate <= now()` | Final value calculated |
| MATURED → REDEEMED | Investor requests redemption | Position closed |

**Invariants:**
1. `appliedAmount` is immutable after creation (snapshot from Order)
2. `rate` is immutable after creation (snapshot from Product at approval time)
3. Only `ACTIVE` applications receive `updateValue()` calls
4. Only `MATURED` applications can be redeemed
5. `endDate` must be after `startDate`

**Methods:**
- `Application.createFromOrder(order, product)` — factory, status = ACTIVE
- `application.updateValue(newValue: Money)` — updates currentValue (ACTIVE only)
- `application.mature(finalValue: Money)` — ACTIVE → MATURED
- `application.redeem()` — MATURED → REDEEMED

**Events raised:** `ApplicationCreatedEvent`, `ApplicationValueUpdatedEvent`, `ApplicationMaturedEvent`, `ApplicationRedeemedEvent`

---

## Domain Services

**`InvestmentCalculationService`** — Calculates updated value for an Application.
Uses Strategy pattern: `SelicCalculationStrategy`, `CdiCalculationStrategy`, `IpcaCalculationStrategy`.
Reads current rates from `market_rates` table (written daily by an external Lambda).

Formulas:
- SELIC: `PU = PU_emissão × (1 + taxa_selic)^(DU/252)`
- CDI: `PU = PU_emissão × (1 + %CDI × taxa_cdi)^(DU/252)`
- IPCA: `PU = PU_emissão × (1 + IPCA) × (1 + spread)^(DU/252)`

**`InvestmentMaturationService`** — Domain service invoked by scheduler. Finds ACTIVE Applications with `endDate <= now()`, calculates final value, calls `mature()`.

**`OrderExpirationService`** — Domain service invoked by scheduler. Finds PENDING/ANALYZING Orders with `expiresAt <= now()`, calls `expire()` and `product.releaseVolume()`.

**`RiskAnalysisService`** — Port (interface in application layer). Infrastructure provides a mock implementation with configurable latency. Returns `APPROVED` or `REJECTED` with reason.

---

## Key Flows

**Order creation (synchronous part):**
1. Validate: product OPEN? volume available? amount >= minimumAmount?
2. `Order.create()` + `product.reserveVolume()` in the **same DB transaction**
3. Persist order, then dispatch `OrderCreatedEvent`

**Order analysis (async consumer):**
1. Consume `OrderCreatedEvent`, call `order.startAnalysis()`
2. Call `RiskAnalysisService`
3. If approved: `order.approve()` + `Application.createFromOrder()` in same transaction
4. If rejected: `order.reject(reason)` + `product.releaseVolume()` in same transaction
5. Dispatch result events

@../../docs/domain/events.md
