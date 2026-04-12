# DDD Implementation Rules

## Base Classes (custom, no external package)

### AggregateRoot

All aggregates extend `AggregateRoot` from `shared/domain`. It owns the common identity fields and collects domain events raised during aggregate methods.

```typescript
// shared/domain/src/lib/aggregate-root/aggregate-root.base.ts
export interface AggregateRootProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class AggregateRoot {
  readonly id: string;
  readonly createdAt: Date;
  protected updatedAt: Date;

  protected constructor(id: string, createdAt: Date, updatedAt: Date) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  getUpdatedAt(): Date { return this.updatedAt; }

  protected apply(event: DomainEvent): this { ... }
  getDomainEvents(): DomainEvent[] { ... }
  clearDomainEvents(): this { ... }
}
```

- `apply()`, `clearDomainEvents()` return `this` for fluent chaining
- `updatedAt` is `protected` — aggregates stamp `this.updatedAt = new Date()` inside every mutating method
- `BaseRepository.save()` in `shared/infrastructure` calls `getDomainEvents()`, writes to `outbox_events`, then `clearDomainEvents()` — all in the same Prisma transaction. Use cases never touch events directly.

### ValueObject

All value objects extend `ValueObject<T>` from `shared/domain` and implement `equals()`.

```typescript
// shared/domain/src/lib/value-objects/value-object.base.ts
export abstract class ValueObject<T extends ValueObject<T>> {
  abstract equals(other: T): boolean;
}
```

```typescript
export class Money extends ValueObject<Money> {
  private constructor(
    readonly amount: Decimal,
    readonly currency: 'BRL',
  ) {
    super();
  }

  static of(amount: Decimal | number | string): Money {
    const decimal = new Decimal(amount);
    if (decimal.lessThanOrEqualTo(0)) throw new InvalidMoneyError(decimal);
    return new Money(decimal, 'BRL');
  }

  equals(other: Money): boolean {
    return this.amount.equals(other.amount) && this.currency === other.currency;
  }
}
```

### DomainEvent

All domain events implement the `DomainEvent` interface and must include a stable `eventId` (UUID generated at raise time). `BaseRepository` uses it as the outbox row `id`, giving the `ProcessedEvent` idempotency table a direct link to the originating event.

```typescript
export interface DomainEvent {
  readonly eventId: string;        // UUID, stable identifier for idempotency
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly context: string;        // SNS topic name, e.g. 'investflow-investments'
}
```

```typescript
export class OrderApprovedEvent implements DomainEvent {
  readonly eventId = crypto.randomUUID();
  readonly eventType = 'OrderApproved';
  readonly aggregateType = 'Order';
  readonly context = 'investflow-investments';
  readonly occurredAt: Date;

  constructor(
    readonly aggregateId: string,
    readonly productId: string,
    readonly amount: Decimal,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
```

- Named in past tense: `OrderApprovedEvent`, `ProductPublishedEvent`
- Immutable — all fields set in constructor, no setters
- Carry only IDs and scalars — no aggregate references

---

## Building Blocks

### Aggregate Root

- Extends `AggregateRoot` from `shared/domain`
- Props interface extends `AggregateRootProps` — never redeclare `id`, `createdAt`, `updatedAt`
- `create(props)` factory — always generates `id` and stamps `createdAt`/`updatedAt` to `new Date()`. Never accepts them as optional inputs — that blurs the line with reconstitution
- `reconstitute(props)` factory — hydrates from a persisted record with its own timestamps; the only path for DB → domain object
- All state changes via public methods — no direct property mutation from outside
- Mutating methods return `this` for fluent chaining and stamp `this.updatedAt = new Date()`
- All domain events raised via `this.apply()` inside those methods
- Single transaction boundary — never modify two aggregates in one transaction

```typescript
export interface OrderProps extends AggregateRootProps {
  productId: string;
  investorId: string;
  amount: Money;
  status: OrderStatus;
  expiresAt: Date;
}

export class Order extends AggregateRoot {
  // domain-specific fields only — id/createdAt/updatedAt come from base

  static create(props: Omit<OrderProps, 'id' | 'status' | 'createdAt' | 'updatedAt'> & { id?: string }): Order {
    const now = new Date();
    return new Order({ ...props, id: props.id ?? crypto.randomUUID(), status: OrderStatus.PENDING, createdAt: now, updatedAt: now });
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  approve(): this {
    if (this._status !== OrderStatus.ANALYZING) throw new InvalidOrderTransitionError(...);
    this._status = OrderStatus.APPROVED;
    this.updatedAt = new Date();
    this.apply(new OrderApprovedEvent(this.id, this.productId, this.amount.amount));
    return this;
  }
}
```

### Entity

- Has identity (`id`) but is NOT an aggregate root
- Lives inside an aggregate, never persisted independently
- Accessed only through its aggregate root

### Value Object

- Extends `ValueObject<T>` from `shared/domain`
- No identity — equality by value via `equals()`
- Immutable — `private constructor`, factory via static `of()` method
- Validate in factory; throw `DomainError` on invalid input
- Return new instances from methods — never mutate
- Use `date-fns` for date comparisons (never raw `<`, `>`, `<=` on `Date` objects)
- Keep in `shared/domain` only if used by 2+ contexts, otherwise in the owning context's `domain/`
- `DateRange` (in `shared/domain`) is the standard VO for any start+end date pair

### Domain Event

- Named in past tense: `OrderApprovedEvent`, `ApplicationCreatedEvent`
- Implements `DomainEvent` interface — always include `eventId`, `eventType`, `aggregateType`, `context`
- Immutable — all fields `readonly`, set in constructor
- Carry only IDs and scalars — no aggregate or VO references

### Use Case

- One class per use case in `application/use-cases/`
- Takes a **command DTO** as its input — a plain typed class co-located in the same folder
- Single public `execute(command)` method
- Orchestrates: load aggregate → call domain method → persist (events handled automatically by repository)
- Returns void or a scalar (ID) — never a domain aggregate
- **Single aggregate per transaction** — if a use case needs to affect another aggregate, it does so via domain events (outbox → SNS → SQS → consumer) or in a separate transaction after the primary one
- **Never call `getDomainEvents()` or `clearDomainEvents()` from a use case** — that is `BaseRepository`'s responsibility

```typescript
// application/use-cases/approve-order/approve-order.command.ts
export class ApproveOrderCommand {
  constructor(readonly orderId: string) {}
}

// application/use-cases/approve-order/approve-order.use-case.ts
export class ApproveOrderUseCase {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(command: ApproveOrderCommand): Promise<void> {
    const order = await this.orderRepo.findByIdOrThrow(command.orderId);
    await this.orderRepo.save(order.approve());
  }
}
```

### CQRS

No mediator bus, no automatic dispatch — handlers are injected and called directly.

**Command DTO** — plain typed class, the input of a use case. Co-located with its use case in `application/use-cases/<feature>/`.

**Query DTO** — plain typed class, the input of a query handler. Co-located with its query handler in `infrastructure/query-handlers/`.

Query handlers live in `infrastructure/query-handlers/` because they depend on Prisma directly. They never load domain aggregates — they query the DB and map to the desired shape. Handler and query interfaces are defined locally — no shared base interface required.

```typescript
// infrastructure/query-handlers/get-product.query-handler.ts
export class GetProductQuery {
  constructor(
    readonly productId: string,
    readonly organizationId: string,
  ) {}
}

@Injectable()
export class GetProductQueryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProductQuery): Promise<{ id: string; name: string; status: string }> {
    return this.prisma.client.investmentProduct.findUniqueOrThrow({
      where: { id: query.productId, organizationId: query.organizationId },
      select: { id: true, name: true, status: true },
    });
  }
}
```

No `*ReadModel` interfaces — return an inline type unless explicitly asked.

### Repository (Port)

- Interface defined in `application/ports/` (port), extending `IRepository<T>` from `shared/domain`
- `IRepository<T>` provides `findById`, `findByIdOrThrow`, and `save` — never redeclare these
- Add aggregate-specific query methods on the concrete port interface
- Implementation in `infrastructure/` (adapter), extending `BaseRepository<T>`
- Returns domain aggregates — not raw DB rows
- Never expose query builder or ORM primitives through the port interface

```typescript
// shared/domain
export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findByIdOrThrow(id: string): Promise<T>;
  save(aggregate: T): Promise<void>;
}

// application/ports/order.repository.ts
export interface IOrderRepository extends IRepository<Order> {
  findExpiredOrders(before: Date): Promise<Order[]>;
  sumActiveOrderAmounts(productId: string): Promise<Money>;
}
```

### BaseRepository (Infrastructure)

- Lives in `shared/infrastructure` — all concrete repositories extend it
- `save(aggregate)`: persist state → write domain events to outbox (using `event.eventId` as the row `id`) → clear events — all in one Prisma transaction
- Concrete repositories only implement `persistAggregate(aggregate, client)` — domain-specific DB writes (typically an upsert)
- This is the **only place in the codebase** that calls `getDomainEvents()` and `clearDomainEvents()`
- Mapper methods (`toRecord` / `toDomain`) are private to the concrete repository

```typescript
export class OrderRepository extends BaseRepository<Order> implements IOrderRepository {
  protected async persistAggregate(order: Order, client: TransactionalPrismaClient): Promise<void> {
    await client.order.upsert({ where: { id: order.id }, create: this.toRecord(order), update: this.toRecord(order) });
  }

  async findExpiredOrders(before: Date): Promise<Order[]> { ... }
  async sumActiveOrderAmounts(productId: string): Promise<Money> { ... }

  private toRecord(order: Order) { ... }
  private toDomain(row: PrismaOrder): Order { ... }
}
```

### Domain Service

- Use when logic spans multiple aggregates and doesn't belong in either
- Stateless — no stored state, only dependencies injected
- Lives in `domain/` layer — cannot depend on infrastructure
- Examples: `InvestmentCalculationService`, `OrderExpirationService`

---

## Anti-Patterns — Never Do These

| Anti-Pattern | What to do instead |
|---|---|
| Anemic domain model — aggregate is a plain data class, logic in services | Put logic inside the aggregate method |
| `new Order({ status: 'APPROVED' })` from outside | Use `Order.create()` factory or transition methods |
| Calling `orderRepo.save()` from a domain service | Domain services receive aggregates, use cases call repos |
| Two aggregate saves in one transaction | Use domain events via outbox to affect the second aggregate asynchronously, or derive shared state via query |
| `if (order.status === 'PENDING') order.status = 'APPROVED'` from use case | Call `order.approve()` — invariant lives in the aggregate |
| Collecting events via `this.apply()` then dispatching from use case | `BaseRepository.save()` writes them to the outbox automatically |
| Calling `getDomainEvents()` or `clearDomainEvents()` from a use case | Only `BaseRepository` does this |
| Publishing events directly to SNS/SQS from use case | Always write to `outbox_events` in the same transaction — `OutboxPollerService` handles SNS delivery |
| Storing derived state on an aggregate to avoid cross-aggregate queries | Derive via query (e.g., volume = SUM of active order amounts) |
| Passing `createdAt` or `updatedAt` as optional to `create()` | `create()` always stamps `new Date()`. Use `reconstitute()` for DB hydration |
| Redeclaring `id`, `createdAt`, `updatedAt` in a props interface | Extend `AggregateRootProps` — they're inherited |
| Value object without `extends ValueObject<T>` | All VOs must extend the base and implement `equals()` |
| Raw `<`, `>`, `<=` operators on `Date` objects | Use `date-fns` functions (`isAfter`, `isBefore`, `isEqual`) |

---

## Naming Conventions

| Building Block | Convention | Example |
|---|---|---|
| Aggregate / Entity | PascalCase noun | `Order`, `InvestmentProduct` |
| Aggregate props interface | PascalCase + `Props` | `OrderProps`, `InvestmentProductProps` |
| Value Object | PascalCase noun | `Money`, `Rate`, `DateRange` |
| Domain Event | PascalCase, past tense + `Event` | `OrderApprovedEvent` |
| Use Case | PascalCase, verb phrase + `UseCase` | `ApproveOrderUseCase` |
| Repository interface | `I` prefix + aggregate + `Repository` | `IOrderRepository` |
| Repository implementation | aggregate + `Repository` | `OrderRepository` |
| Domain Service | descriptive + `Service` | `InvestmentCalculationService` |

---

## File Structure per Layer

```
investments/
  domain/
    src/lib/
      aggregates/
        order/
          order.aggregate.ts          ← extends AggregateRoot
          order.aggregate.spec.ts     ← unit tests (no DB, no NestJS)
      value-objects/
        money.vo.ts                   ← extends ValueObject<Money>
        rate.vo.ts                    ← extends ValueObject<Rate>
      events/
        order-approved.event.ts       ← implements DomainEvent
      services/
        investment-calculation.service.ts
      errors/
        invalid-order-transition.error.ts
  application/
    src/lib/
      use-cases/
        approve-order/
          approve-order.use-case.ts
          approve-order.use-case.spec.ts
      ports/
        order.repository.ts           ← IOrderRepository extends IRepository<Order>
  infrastructure/
    src/lib/
      repositories/
        order.repository.ts           ← extends BaseRepository<Order>, implements IOrderRepository
      consumers/
        order-created.consumer.ts     ← event consumer, calls use case
```
