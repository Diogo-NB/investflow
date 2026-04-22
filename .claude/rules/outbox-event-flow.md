# Transactional Outbox — Event Publishing Flow

## Overview

Domain events are never published directly to a message broker. They are always written to the `outbox_events` database table in the same transaction that persists the aggregate, then published asynchronously by `OutboxPollerService`.

This guarantees at-least-once delivery without distributed transactions.

---

## Step-by-Step Flow

### 1. Aggregate raises a domain event

Inside an aggregate method, call `this.apply(event)` to queue the event:

```typescript
publish(): this {
  this._status = ProductStatus.OPEN;
  this.updatedAt = new Date();
  this.apply(new ProductPublishedEvent(this.id, this.organizationId, ...));
  return this;
}
```

Events are stored in `_domainEvents[]` on the `AggregateRoot` base class. The use case never touches this array.

### 2. Use case calls `repo.save(aggregate)`

```typescript
await this.productRepo.save(product.publish());
```

That is all the use case does — no event dispatching, no `getDomainEvents()` calls.

### 3. `BaseRepository.save()` writes atomically

`libs/shared/infrastructure/src/lib/base.repository.ts`

In one Prisma transaction:
1. `persistAggregate(aggregate, client)` — concrete repo upserts the aggregate row
2. `client.outboxEvent.createMany(...)` — one row per event, using `event.eventId` as the row `id`
3. `aggregate.clearDomainEvents()` — empties the queue

The `context` field on each `DomainEvent` (e.g. `'investflow-investments'`) identifies the SNS topic ARN the event belongs to.

### 4. `TransactionInterceptor` ensures atomicity

`libs/shared/infrastructure/src/lib/prisma/transaction.interceptor.ts`

Every HTTP request is wrapped in `prisma.$transaction()`. Repositories obtain the transactional client via `AsyncLocalStorage` (`TransactionContext`). The aggregate write and outbox insert are always in the same DB transaction — either both commit or both roll back.

Use `@SkipTransaction()` on a controller handler only when truly not needed (e.g., read-only endpoints).

### 5. `OutboxPollerService` publishes every 5 seconds

`libs/shared/infrastructure/src/lib/outbox/outbox-poller.service.ts`

```
@Cron every 5 seconds:
  SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 100
  FOR EACH event:
    SnsMessageBroker.publish(event.context, JSON.stringify(event.payload))
    UPDATE outbox_events SET published_at = NOW() WHERE id = event.id
    (both inside a DB transaction — if publish fails, the row stays unpublished and is retried)
```

`event.context` is the SNS topic ARN. The poller knows nothing about consumers.

### 6. SNS fans out to SQS queues

- One SNS topic per bounded context: `investflow-investments`, `investflow-portfolio`, etc.
- One SQS queue + DLQ per consumer: e.g., `investflow-portfolio-events` + `investflow-portfolio-events-dlq`
- DLQ activation is configured on the SQS queue (`maxReceiveCount: 3` on the RedrivePolicy) — not in code
- The publisher (`OutboxPollerService`) publishes only to the SNS topic — zero coupling to consumers
- SNS delivers to all subscribed SQS queues

SNS wraps each message in an envelope:
```json
{
  "Type": "Notification",
  "MessageId": "...",
  "TopicArn": "arn:aws:sns:...",
  "Message": "<JSON string of the original DomainEvent payload>"
}
```

The `Message` field contains `JSON.stringify(event.payload)` as written by the poller.

### 7. `SqsConsumerBase` processes the event

`libs/shared/infrastructure/src/lib/sqs/sqs-consumer.base.ts`

```
@Interval every 5 seconds:
  ReceiveMessage from SQS (up to 10 messages, short-poll)
  FOR EACH message:
    1. Parse SQS Body as SNS envelope
    2. Parse envelope.Message as DomainEvent payload
    3. Extract eventId — if missing, discard (poison pill) and delete message
    4. prisma.$transaction(tx =>
         TransactionContext.run(tx, async () => {
           tx.processedEvent.create({ id: eventId })   ← PK conflict = already processed
           handle(domainEvent)                          ← concrete consumer dispatches to use cases
         })
       )
    5. Delete SQS message AFTER transaction commits
    6. On P2002 (duplicate PK): log warn + delete message (idempotent skip)
    7. On any other error: log error + do NOT delete → visibility timeout expires → SQS retries → DLQ after maxReceiveCount
```

`TransactionContext.run(tx, ...)` is called inside the `$transaction` callback, so `PrismaService.client` returns the transactional client throughout `handle()` — use cases and repositories work identically to an HTTP request.

Concrete consumers extend `SqsConsumerBase` and implement:
- `getQueueUrl()` — returns the SQS queue URL from config (called once at `onModuleInit`)
- `handle(eventPayload)` — dispatches to use cases based on `eventPayload.eventType`

---

## Key invariants

| Rule | Reason |
|---|---|
| Never publish to SNS/SQS directly from a use case | Breaks atomicity — the aggregate could be saved but the event lost if the process crashes |
| Never call `getDomainEvents()` or `clearDomainEvents()` from a use case | Only `BaseRepository` does this |
| `event.eventId` is the `outbox_events.id` and `processed_events.id` | Links outbox row to originating event; enables idempotency check |
| `event.context` is the SNS topic ARN | The only coupling between producer and broker |
| Consumers must be idempotent via `processed_events` | SNS+SQS delivers at-least-once; duplicate delivery must be safe |
| One SNS topic per bounded context | Keeps coupling at the context level, not the event level |
| `SqsConsumerBase` does NOT delete the message on failure | Lets SQS handle retries and DLQ natively via visibility timeout + RedrivePolicy |
| `TransactionContext.run()` is called inside `$transaction` in `SqsConsumerBase` | Ensures `PrismaService.client` returns the transactional client for all downstream use cases |

---

## Relevant files

| Component | Path |
|---|---|
| `AggregateRoot` | `libs/shared/domain/src/lib/aggregate-root/aggregate-root.base.ts` |
| `DomainEvent` interface | `libs/shared/domain/src/lib/domain-event/domain-event.interface.ts` |
| `BaseRepository` | `libs/shared/infrastructure/src/lib/base.repository.ts` |
| `TransactionInterceptor` | `libs/shared/infrastructure/src/lib/prisma/transaction.interceptor.ts` |
| `TransactionContext` | `libs/shared/infrastructure/src/lib/prisma/transaction.context.ts` |
| `OutboxPollerService` | `libs/shared/infrastructure/src/lib/outbox/outbox-poller.service.ts` |
| `IMessageBroker` port | `libs/shared/infrastructure/src/lib/outbox/message-broker.port.ts` |
| `SnsMessageBroker` | `libs/shared/infrastructure/src/lib/outbox/sns-message-broker.ts` |
| `ConsoleMessageBroker` (dev placeholder) | `libs/shared/infrastructure/src/lib/outbox/console-message-broker.ts` |
| `OutboxModule` | `libs/shared/infrastructure/src/lib/outbox/outbox.module.ts` |
| `SqsConsumerBase` | `libs/shared/infrastructure/src/lib/sqs/sqs-consumer.base.ts` |
| `PortfolioEventsConsumer` | `libs/portfolio/infrastructure/src/lib/consumers/portfolio-events.consumer.ts` |
| Prisma schema (`outbox_events`, `processed_events`) | `libs/shared/infrastructure/prisma/schema.prisma` |
