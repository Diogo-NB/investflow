# DDD Implementation Rules

## Base Classes (custom, no external package)

All aggregates extend a custom `AggregateRoot` base class defined in `shared/domain`. It collects domain events raised during aggregate methods so the use case can dispatch them after persisting state.

```typescript
// shared/domain/src/lib/aggregate-root.base.ts
export abstract class AggregateRoot {
  private readonly _domainEvents: DomainEvent[] = [];

  protected apply(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
```

```typescript
// In a use case — just save, events are handled by the repository automatically:
order.approve();
await this.orderRepo.save(order); // persists state + writes domain events to outbox (same tx)
```

> `BaseRepository.save()` in `shared/infrastructure` calls `aggregate.getDomainEvents()`, writes them to `outbox_events`, then calls `aggregate.clearDomainEvents()` — all within the same Prisma transaction. Use cases never touch events directly.

## Building Blocks

### Aggregate Root

- Extends `AggregateRoot` from `shared/domain`
- Single transaction boundary — never modify two aggregates in one transaction
- All state changes via public methods — no direct property mutation from outside
- All domain events raised via `this.apply()` inside those methods
- Factory via static `create(props)` method — validates invariants before returning instance

### Entity

- Has identity (`id`) but is NOT an aggregate root
- Lives inside an aggregate, never persisted independently
- Accessed only through its aggregate root

### Value Object

- No identity — equality by value
- Immutable — return new instance instead of mutating
- Validate in constructor; throw `DomainError` on invalid input
- Keep in `shared/domain` only if used by 2+ contexts, otherwise in the owning context's `domain/`

```typescript
export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: 'BRL',
  ) {
    if (amount.lessThanOrEqualTo(0)) throw new InvalidMoneyError(amount);
  }

  static of(amount: Decimal): Money {
    return new Money(amount, 'BRL');
  }

  add(other: Money): Money {
    return Money.of(this.amount.plus(other.amount));
  }
}
```

### Domain Event

- Named in past tense: `OrderApprovedEvent`, `ApplicationCreatedEvent`
- Immutable — all fields set in constructor, no setters
- Plain class, no framework interface needed
- Carry only IDs and scalars — no aggregate references

```typescript
export class OrderApprovedEvent {
  constructor(
    readonly orderId: string,
    readonly productId: string,
    readonly amount: Decimal,
    readonly occurredAt: Date = new Date(),
  ) {}
}
```

### Use Case

- One class per use case in `application/use-cases/`
- Single public `execute(input)` method
- Orchestrates: load aggregate → call domain method → persist (events handled automatically by repository)
- Returns void or a scalar (ID) — never a domain aggregate
- **Single aggregate per transaction** — if a use case needs to affect another aggregate, it does so via domain events (outbox → SQS → consumer) or in a separate transaction after the primary one
- **Never call `getDomainEvents()` or `clearDomainEvents()` from a use case** — that is `BaseRepository`'s responsibility

```typescript
export class ApproveOrderUseCase {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.orderRepo.findByIdOrThrow(orderId);
    order.approve();
    await this.orderRepo.save(order); // state + domain events written atomically
  }
}
```

### Repository (Port)

- Interface defined in `application/ports/` (port)
- Implementation in `infrastructure/` (adapter)
- Returns domain aggregates — not raw DB rows
- Write methods accept aggregates; read methods return aggregates or `null`
- Never expose query builder or ORM primitives through the port interface

```typescript
// application/ports/order.repository.ts
export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByIdOrThrow(id: string): Promise<Order>;
  save(order: Order): Promise<void>;
  findExpiredOrders(before: Date): Promise<Order[]>;
  sumActiveOrderAmounts(productId: string): Promise<Money>;
}
```

### BaseRepository (Infrastructure)

- Lives in `shared/infrastructure` — all concrete repositories extend it
- Defines the `save(aggregate: T)` template: persist state → write domain events to outbox → clear events
- Concrete repositories only implement `persistAggregate(aggregate, client)` — the domain-specific DB writes
- This is the **only place in the codebase** that calls `getDomainEvents()` and `clearDomainEvents()`

```typescript
// shared/infrastructure/src/lib/base.repository.ts
export abstract class BaseRepository<T extends AggregateRoot> {
  constructor(protected readonly prisma: PrismaService) {}

  async save(aggregate: T): Promise<void> {
    const client = this.prisma.client; // transactional client from AsyncLocalStorage
    await this.persistAggregate(aggregate, client);
    const events = aggregate.getDomainEvents();
    if (events.length > 0) {
      await client.outboxEvent.createMany({ data: events.map(serialize) });
      aggregate.clearDomainEvents();
    }
  }

  protected abstract persistAggregate(
    aggregate: T,
    client: TransactionalPrismaClient,
  ): Promise<void>;
}

// OrderRepository — only cares about Order-specific persistence
export class OrderRepository extends BaseRepository<Order> implements IOrderRepository {
  protected async persistAggregate(order: Order, client: TransactionalPrismaClient): Promise<void> {
    await client.order.upsert({ /* ... */ });
  }
  // query methods (findById, sumActiveOrderAmounts, etc.) defined here
}
```

### Domain Service

- Use when logic spans multiple aggregates and doesn't belong in either
- Stateless — no stored state, only dependencies injected
- Lives in `domain/` layer — cannot depend on infrastructure
- Examples: `InvestmentCalculationService`, `OrderExpirationService`

## Anti-Patterns — Never Do These

| Anti-Pattern | What to do instead |
|---|---|
| Anemic domain model — aggregate is a plain data class, logic in services | Put logic inside the aggregate method |
| `new Order({ status: 'APPROVED' })` from outside | Use `Order.create()` factory or transition methods |
| Calling `orderRepo.save()` from a domain service | Domain services receive aggregates, use cases call repos |
| Two aggregate saves in one transaction | Redesign: use domain events via outbox to affect the second aggregate asynchronously, or derive the shared state via query (e.g., allocated volume = SUM of active order amounts) |
| `if (order.status === 'PENDING') order.status = 'APPROVED'` from use case | Call `order.approve()` — invariant lives in the aggregate |
| Publishing events inside the aggregate method | Collect via `this.apply()` — `BaseRepository.save()` writes them to the outbox automatically |
| Calling `getDomainEvents()` or `clearDomainEvents()` from a use case | Only `BaseRepository` does this — use cases just call `repo.save()` |
| Publishing events directly to SQS from use case | Always write to `outbox_events` table in the same transaction — `OutboxPollerService` handles SQS delivery |
| Storing derived state on an aggregate to avoid cross-aggregate queries | Derive via query (e.g., volume = SUM of order amounts) — keeps aggregates independent |

## Naming Conventions

| Building Block | Convention | Example |
|---|---|---|
| Aggregate / Entity | PascalCase noun | `Order`, `InvestmentProduct` |
| Value Object | PascalCase noun | `Money`, `Rate`, `ProductPeriod` |
| Domain Event | PascalCase, past tense + `Event` | `OrderApprovedEvent` |
| Use Case | PascalCase, verb phrase + `UseCase` | `ApproveOrderUseCase` |
| Repository interface | `I` prefix + aggregate + `Repository` | `IOrderRepository` |
| Repository implementation | aggregate + `Repository` | `OrderRepository` |
| Domain Service | descriptive + `Service` | `InvestmentCalculationService` |

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
        money.vo.ts
        rate.vo.ts
      events/
        order-approved.event.ts
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
        order.repository.ts           ← IOrderRepository interface
  infrastructure/
    src/lib/
      repositories/
        order.repository.ts           ← implements IOrderRepository
      consumers/
        order-created.consumer.ts     ← event consumer, calls use case
```
