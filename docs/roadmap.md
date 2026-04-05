# InvestFlow — Implementation Roadmap

> Each step is scoped to fit within a single AI chat session and produces a testable state of the system.
> Steps build incrementally — each one leaves the app in a runnable/verifiable condition.

---

## Current Baseline

- Nx monorepo scaffolded with all libs (`investments/*`, `portfolio/*`, `shared/*`) and `apps/api`
- Prisma 7 configured in `shared/infrastructure` with AsyncLocalStorage transaction support
- Keycloak running in Docker (`infra/keycloak/`)
- All lib modules are empty placeholders

---

## Step 1 — Shared Domain Foundation

**Goal:** Implement the base building blocks used by all aggregates and the event publishing port.

**Deliverables:**
- `AggregateRoot` base class (`shared/domain`) — `apply()`, `getDomainEvents()`, `clearDomainEvents()`
- `DomainEvent` base interface (`shared/domain`)
- Value Objects in `shared/domain`:
  - `Money` (amount: Decimal, currency: 'BRL') — validates amount > 0, arithmetic methods (add, subtract, greaterThan, etc.)
  - `Rate` (value: Decimal, referenceType: enum) — validates value > 0
  - `InvestmentType` enum (`SELIC | CDI | IPCA`)
- `DomainError` base class (`shared/domain`)
- Unit tests for all Value Objects

**Testable:** `pnpm nx test shared-domain` passes

---

## Step 2 — Keycloak JWT Auth Integration

**Goal:** JWT guard wired into NestJS, roles and claims extractable from requests.

**Deliverables:**
- `JwtAuthGuard` (global) in `shared/infrastructure` — validates Keycloak-issued JWTs
- `RolesGuard` + `@Roles()` decorator — enforces `INVESTOR` | `ORG_USER`
- `CurrentUser` decorator — extracts `userId`, `organizationId`, `roles` from JWT claims
- `AuthenticatedUser` type in `shared/types`
- Guard applied globally in `apps/api/app.module.ts`
- Keycloak realm/client configured (or documented setup steps)

**Testable:** `GET /health` returns 401 without token; returns 200 with valid Keycloak JWT

---

## Step 3 — Transactional Outbox Infrastructure + BaseRepository

**Goal:** `BaseRepository` handles event persistence automatically. The outbox table and poller are operational — SQS integration is stubbed (logged to console) until LocalStack is set up in Step 8.

**Deliverables:**
- Prisma schema: `outbox_events` table + `processed_events` table (migration)
- `BaseRepository<T extends AggregateRoot>` (`shared/infrastructure`):
  - `save(aggregate)` — calls `persistAggregate()`, writes `getDomainEvents()` to outbox, calls `clearDomainEvents()` — all in same Prisma transaction
  - `abstract persistAggregate(aggregate, client): Promise<void>` — implemented by each concrete repository
- `OutboxPollerService` (`shared/infrastructure`) — `@Cron` every 5s, reads unpublished events, marks `published_at`. SQS publish behind `IMessageBroker` port (console-logged for now)
- `IMessageBroker` port (`shared/infrastructure`) — `send(queueName, message): Promise<void>`
- `OutboxModule` wired into `apps/api`

**Testable:** Implement a minimal test aggregate + repository extending `BaseRepository` → call `save()` → `outbox_events` row appears → poller logs the event payload

---

## Step 4 — InvestmentProduct Domain + Persistence

**Goal:** Full Product aggregate with state machine, events, and DB persistence.

**Deliverables:**
- `InvestmentProduct` aggregate (`investments/domain`):
  - Value Objects: `Indexer`, `ProductPeriod`, `ProductStatus` enum
  - Methods: `create()`, `publish()`, `validateAcceptsOrders()`, `close()`
  - Events: `ProductPublishedEvent`, `ProductClosedEvent`
  - Invariants enforced in all methods
  - **No `allocatedVolume` field** — volume is derived via query
- `IProductRepository` port (`investments/application`)
- Prisma schema: `investment_products` table (migration)
- `ProductRepository` implementation (`investments/infrastructure`)
- Unit tests for aggregate (no DB)

**Testable:** `pnpm nx test investments-domain` passes (aggregate unit tests)

---

## Step 5 — Product API (ORG_USER)

**Goal:** REST endpoints for managing products, secured by role.

**Deliverables:**
- Use cases (`investments/application`):
  - `CreateProductUseCase` — creates product (DRAFT), publishes events to outbox
  - `PublishProductUseCase` — DRAFT → OPEN, publishes `ProductPublishedEvent` to outbox
  - `GetProductUseCase`
  - `ListProductsUseCase`
- `ProductsController` in `investments/infrastructure` — wired into `apps/api`
- Request DTOs + validation (class-validator)
- `@Roles('ORG_USER')` on write endpoints; `@Roles('ORG_USER', 'INVESTOR')` on reads
- All queries scoped by `organizationId`

**Testable:**
- `POST /products` creates product (ORG_USER JWT)
- `PATCH /products/:id/publish` transitions to OPEN, `outbox_events` row appears
- `GET /products` returns only org's products
- `POST /products` returns 403 with INVESTOR JWT

---

## Step 6 — Order Domain + Persistence

**Goal:** Order aggregate with state machine, invariants, and DB persistence.

**Deliverables:**
- `Order` aggregate (`investments/domain`):
  - Methods: `create()`, `startAnalysis()`, `approve()`, `reject()`, `expire()`
  - Events: `OrderCreatedEvent`, `OrderAnalysisStartedEvent`, `OrderApprovedEvent`, `OrderRejectedEvent`, `OrderExpiredEvent`
  - Invariants: unidirectional transitions, amount validation (minimum checked in use case)
  - **`Order.create()` does NOT receive Product** — volume validation is in the use case via derived query
- `IOrderRepository` port (`investments/application`):
  - Standard CRUD methods
  - `sumActiveOrderAmounts(productId: string): Promise<Money>` — derived volume query
- Prisma schema: `orders` table (migration) with index on `(product_id, status)` for the volume query
- `OrderRepository` implementation (`investments/infrastructure`)
- Unit tests for aggregate

**Testable:** `pnpm nx test investments-domain` passes (Order unit tests)

---

## Step 7 — Create Order API + Derived Volume Validation

**Goal:** INVESTOR can create an order; volume is validated via derived query, single aggregate transaction.

**Deliverables:**
- `CreateOrderUseCase` (`investments/application`):
  - Loads product → `product.validateAcceptsOrders()` (read-only, checks OPEN status)
  - Queries `orderRepo.sumActiveOrderAmounts(productId)` → calculates available volume
  - Validates amount >= minimumAmount and amount <= available volume
  - `Order.create()` — **single aggregate transaction** (only Order is persisted)
  - `OrderCreatedEvent` written to outbox in same transaction
  - After commit: checks if volume is now exhausted → if so, `product.close()` in a separate transaction
- `OrdersController` in `investments/infrastructure`
- `@Roles('INVESTOR')` guard; query scoped by `userId`
- `GetOrderUseCase` + `ListOrdersUseCase`

**Testable:**
- `POST /orders` with valid product returns Order (PENDING), `outbox_events` row appears
- `POST /orders` with CLOSED product returns 422
- `POST /orders` with amount < minimum returns 422
- `POST /orders` with amount > available volume returns 422
- Product auto-closes when volume is exhausted

---

## Step 8 — SNS + SQS Integration (LocalStack)

**Goal:** Outbox events are published to SNS and fan out to SQS queues via LocalStack.

**Deliverables:**
- LocalStack added to `docker-compose.yml`
- Init script (`infra/localstack/init.sh`) runs on startup:
  - Creates SNS topic: `investflow-investments`
  - Creates SQS queues: `investflow-portfolio-events`, `investflow-portfolio-events-dlq`
  - Subscribes `investflow-portfolio-events` to `investflow-investments` SNS topic
  - Sets redrive policy on `investflow-portfolio-events` → DLQ after 3 failures
- `SnsMessageBroker` (`shared/infrastructure`) — implements `IMessageBroker`, publishes to SNS topic ARN via AWS SDK. Topic ARN resolved from `context` field on outbox event
- `SqsConsumerBase` (`shared/infrastructure`) — polls SQS, unwraps SNS envelope, checks `processed_events` idempotency, calls `handle()`, handles retry + DLQ
- `OutboxPollerService` now wired with `SnsMessageBroker` instead of console stub
- Environment config: `AWS_ENDPOINT`, `SNS_INVESTMENTS_TOPIC_ARN`, `SQS_PORTFOLIO_QUEUE_URL`

**Testable:**
- Create an order → outbox row written → poller publishes to SNS → message arrives in `investflow-portfolio-events` SQS queue
- SNS envelope correctly unwrapped by `SqsConsumerBase`
- Message sent to DLQ after 3 failed processing attempts

---

## Step 9 — Application Domain + Persistence

**Goal:** Application aggregate with full lifecycle and DB persistence.

**Deliverables:**
- `Application` aggregate (`investments/domain`):
  - Value Object: `ApplicationPeriod`
  - Methods: `createFromOrder()`, `updateValue()`, `mature()`, `redeem()`
  - Events: `ApplicationCreatedEvent`, `ApplicationValueUpdatedEvent`, `ApplicationMaturedEvent`, `ApplicationRedeemedEvent`
  - Invariants: appliedAmount immutable, only ACTIVE can updateValue, only MATURED can redeem
- `IApplicationRepository` port (`investments/application`)
- Prisma schema: `applications` table (migration)
- `ApplicationRepository` implementation (`investments/infrastructure`)
- Unit tests for aggregate

**Testable:** `pnpm nx test investments-domain` passes (Application unit tests)

---

## Step 10 — Order Consumer + Async Analysis Flow

**Goal:** SQS consumer processes `OrderCreatedEvent`, runs mock risk analysis, creates Application on approval.

**Deliverables:**
- `RiskAnalysisService` interface (port) + mock implementation — simulates APPROVED/REJECTED
- `AnalyzeOrderUseCase` (`investments/application`):
  - `order.startAnalysis()` → calls RiskAnalysisService
  - If approved: `order.approve()` — save Order + `OrderApprovedEvent` to outbox (single aggregate tx)
  - Then in separate tx: `Application.createFromOrder()` — save Application + `ApplicationCreatedEvent` to outbox
  - If rejected: `order.reject(reason)` — save Order + `OrderRejectedEvent` to outbox (single aggregate tx)
- `OrderCreatedConsumer` SQS consumer (`investments/infrastructure`) — extends `SqsConsumerBase`
- `ListApplicationsUseCase` + `GET /applications` endpoint

**Testable:**
- Publish `OrderCreatedEvent` to SQS → Order transitions to ANALYZING → APPROVED/REJECTED
- Approved: Application record created with status ACTIVE
- Rejected: no Application created, volume automatically freed (terminal Order excluded from derived query)
- Duplicate message ignored (idempotency via `processed_events`)

---

## Step 11 — Investment Calculation Service

**Goal:** Value calculation for all three indexer types using market rates from DB.

**Deliverables:**
- Prisma schema: `market_rates` table (migration) + seed with sample SELIC/CDI/IPCA rates
- `IMarketRateRepository` port + implementation
- `InvestmentCalculationService` (`investments/domain`) with Strategy pattern:
  - `SelicCalculationStrategy`
  - `CdiCalculationStrategy`
  - `IpcaCalculationStrategy`
- Unit tests covering calculation formulas with known inputs/outputs

**Testable:** `pnpm nx test investments-domain` — calculation tests with seeded rates produce expected values

---

## Step 12 — Schedulers: Order Expiration + Application Maturation

**Goal:** Automated lifecycle transitions via NestJS scheduled tasks.

**Deliverables:**
- `ExpireOrdersUseCase` (`investments/application`):
  - Finds PENDING/ANALYZING orders where `expiresAt <= now()`
  - For each: `order.expire()` — single aggregate transaction
  - `OrderExpiredEvent` written to outbox
  - Volume automatically freed (terminal state excluded from derived query)
- `MatureApplicationsUseCase` (`investments/application`):
  - Finds ACTIVE applications where `endDate <= now()`
  - Uses `InvestmentCalculationService` for final value
  - `application.mature(finalValue)` — single aggregate transaction
  - `ApplicationMaturedEvent` written to outbox
- `SchedulerModule` (`investments/infrastructure`) — NestJS `@Cron` tasks wiring both use cases

**Testable:**
- Seed an order with `expiresAt` in the past → scheduler run → Order becomes EXPIRED
- Seed an application with `endDate` in the past → scheduler run → Application becomes MATURED

---

## Step 13 — Redemption API

**Goal:** INVESTOR can redeem a matured application.

**Deliverables:**
- `RedeemApplicationUseCase` (`investments/application`):
  - Validates Application is MATURED and belongs to investor
  - `application.redeem()` → `ApplicationRedeemedEvent` written to outbox
- `POST /applications/:id/redeem` endpoint

**Testable:**
- `POST /applications/:id/redeem` on MATURED application → status becomes REDEEMED
- Same endpoint on ACTIVE application returns 422
- INVESTOR cannot redeem another investor's application (403)

---

## Step 14 — Portfolio Projection (Read Model)

**Goal:** Portfolio context maintains a consolidated position view updated by Application events.

**Deliverables:**
- `PortfolioPosition` read model (`portfolio/domain` — plain class, no aggregate)
- Prisma schema: `portfolio_positions` table (migration)
- `IPortfolioPositionRepository` (`portfolio/application`)
- `PortfolioPositionRepository` (`portfolio/infrastructure`)
- `UpdatePortfolioPositionUseCase` (`portfolio/application`) — handles all Application events
- SQS consumers in `portfolio/infrastructure` (extend `SqsConsumerBase`):
  - `ApplicationCreatedConsumer`
  - `ApplicationValueUpdatedConsumer`
  - `ApplicationMaturedConsumer`
  - `ApplicationRedeemedConsumer`
- `GET /portfolio` endpoint — returns consolidated positions for authenticated user

**Testable:**
- End-to-end: create order → approve → Application created → Portfolio position appears
- Maturation updates `currentValue` in position
- Redemption decrements `activeCount`

---

## Step 15 — Resilience: Retry, DLQ, and Idempotency Hardening

**Goal:** System tolerates transient failures and duplicate messages without data corruption.

**Deliverables:**
- `SqsConsumerBase` enhanced with exponential backoff retry (configurable max attempts)
- DLQ configured for each SQS queue (LocalStack)
- Idempotency via `processed_events` verified across all consumers
- Integration tests: simulate consumer failure → message retried → eventually processed
- Integration tests: send duplicate event → second processing skipped

**Testable:**
- Consumer throwing on first attempt retries and eventually succeeds
- Processed event ID deduplicated across all consumers

---

## Step 16 — Structured Logging + Observability

**Goal:** All requests and consumer executions emit structured JSON logs with required fields.

**Deliverables:**
- `LoggingInterceptor` (`shared/infrastructure`) — per-request JSON log with `userId`, `organizationId`, `correlationId`, method, path, duration, status
- `CorrelationIdMiddleware` — generates/propagates `X-Correlation-ID`
- Consumer logging — each message processed logs `eventType`, `eventId`, `correlationId`, duration, outcome
- Wired globally in `apps/api`

**Testable:**
- HTTP request produces JSON log line with all required fields
- Consumer processing produces JSON log with eventId and outcome

---

## Dependency Graph

```
Step 1 (Shared Domain)
  ├── Step 2 (Auth)
  └── Step 3 (Outbox Infrastructure)
        └── Step 4 (Product Domain)
              └── Step 5 (Product API)
                    └── Step 6 (Order Domain)
                          └── Step 7 (Order API + Derived Volume)
                                └── Step 8 (SQS / LocalStack)
                                      └── Step 9 (Application Domain)
                                            └── Step 10 (Order Consumer)
                                                  └── Step 11 (Calculation)
                                                        └── Step 12 (Schedulers)
                                                  └── Step 13 (Redemption)
                                                        └── Step 14 (Portfolio)
Steps 15–16 can run after Step 10 is complete
```

---

## Infrastructure Prerequisites (one-time setup)

Before starting Step 2, ensure:
- `docker-compose up` starts PostgreSQL and Keycloak
- Keycloak realm `investflow` exists with client `api`, roles `INVESTOR` and `ORG_USER`
- `.env` has `DATABASE_URL`, `KEYCLOAK_URL`

Before starting Step 8, ensure:
- LocalStack added to `docker-compose.yml`
- `.env` has `AWS_ENDPOINT`, `AWS_REGION`, `SNS_INVESTMENTS_TOPIC_ARN`, `SQS_PORTFOLIO_QUEUE_URL`
