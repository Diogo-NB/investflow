---
name: investflow-eventing
description: Implement, review, or refactor InvestFlow transactional messaging. Use for domain events, outbox persistence or polling, EventBridge routing, SQS consumers, processed-event tracking, retries, dead-letter behavior, idempotency, or host activation of messaging workers. Do not use for backend changes without event publication or consumption.
---

# InvestFlow Eventing

Preserve atomic event persistence and at-least-once delivery across bounded
contexts. `docs/architecture/event-flow.md` walks through the whole flow,
including simulation recalculation, with diagrams.

## Publishing flow

1. Events are recorded in the current **unit of work**. Every writing entry
   point runs inside `UnitOfWork.run()` (`persistence/unit-of-work.ts`): the
   HTTP `TransactionInterceptor`, `EventDispatcher` for consumers, and the
   seed. It opens the Prisma transaction and buffers the recorded events.
2. Two ways to record:
   - **Aggregates** raise an immutable, past-tense `DomainEvent` through
     `apply()`. `BaseRepository.save()` persists the aggregate, hands its
     events to `DomainEventRecorder`, and calls `markPersisted()`.
   - **Domain and application services** inject `DomainEventRecorder`
     (`@investflow/shared-domain`) and call `record(...events)` directly. Use it
     for bulk work that does not load aggregates, such as fan-out pages.
3. `TransactionalDomainEventRecorder` validates each event with `OutboxWriter`
   when it is recorded and buffers the rows. Recording outside a unit of work
   throws, because the event would be lost. Just before commit, `UnitOfWork`
   appends the buffer to `outbox_events` in chunks of 1,000 rows, so changes
   and their events commit together or not at all. Rows of one transaction
   share `created_at` and publish in no particular order. The writer owns the
   row format, serialization, and payload limit, so the outbox table is
   touched only in `messaging/outbox` and by `UnitOfWork`.
4. `OutboxPollerService` hands each unpublished row to the `MessageBroker`
   port. `EventBridgeMessageBroker` puts it on the `investflow` bus with
   `source` `investflow.<context>` and `detail-type` set to the event type,
   and fails when EventBridge rejects the entry.
5. The poller publishes outside any transaction and marks the row published
   afterwards, so a crash in between republishes it; consumers deduplicate.
   A poll runs every second and is skipped while the previous one runs.
6. A failed event records `attempts`, `lastError`, and a `nextAttemptAt`
   backed off exponentially up to 5 minutes; only due rows are fetched, so a
   failing event never blocks newer ones and is retried indefinitely. Three
   consecutive failures of different events pause the whole poller (1 second,
   doubling up to 60) until a publication succeeds; each pause costs 3 calls
   and 3 warnings, and the pause and resume are logged once.
7. `OutboxWriter` rejects an event whose payload exceeds the outbox limit
   (200 KB) at `record()`. `BaseRepository.save()` lets that failure throw
   rather than return an error, so the whole unit of work rolls back with
   nothing written. The limit is the outbox's own contract: events carry
   identifiers and changed fields, not documents, and every broker adapter
   must accept payloads of that size.

Routing lives in the broker adapter and the EventBridge rules; the poller and
the port know no topics, buses, or queues. The deployable host decides whether
an outbox poller is active by importing `OutboxModule`.

## Event contract

- Use the domain event ID for the outbox identity and downstream
  processed-event identity.
- Keep event type and version stable and explicit. Use a logical bounded-context
  name for routing rather than a deployment name.
- Keep payloads scalar and serialization-safe; do not include domain objects or
  ORM records.
- Keep `occurredAt` as `UtcInstant` in memory. Infrastructure serializes it to a
  canonical UTC ISO string for the payload and converts it to native `Date`
  only for database timestamp fields.

## Consumers

- A consumer is a plain `@Injectable()` class in its context's
  infrastructure, provided by the context module that owns its dependencies,
  with one `@OnEvent('EventType')` method per handled event that calls an
  application use case. It knows nothing about SQS or EventBridge.
- `EventDispatcher` records `(consumer class name, event ID)` in
  `processed_events` and runs the handler in the same Prisma transaction, so a
  duplicate delivery is skipped and a handler failure rolls the record back.
  Consumer class names must be unique.
- `SqsEventListener` long-polls one queue, reads the event from the
  EventBridge `detail`, and deletes the message only after it was handled or
  recognized as a duplicate. Handler failures and malformed messages stay in
  the queue and reach its dead-letter queue after 5 receives.
- The host activates consumers explicitly with
  `SqsConsumersModule.register([{ consumer, queueUrlConfigKey }])`.
- Treat delivery as at least once and make consumer effects idempotent.
- Leave delivery mechanics to the queue: the visibility timeout keeps a
  message with one worker, redelivery recovers crashed workers, and the
  dead-letter queue ends retries. Do not add leases, claims, or retry counters
  to domain or application code.
- Queues are SQS FIFO, grouped by `$.detail.aggregateId`, so one message per
  aggregate is in flight at a time across every consumer instance. Rely on
  that exclusivity, never on delivery order, and read current state. Do not
  add generation counters or per-input conditions to keep asynchronously
  derived state current. Handle messages of one group sequentially, even when
  a listener processes different groups concurrently, and keep a handler
  within the visibility timeout or extend it while working.
- Floci enforces FIFO groups but does not evaluate the dynamic group path,
  so locally every queue is one group and runs serially. Do not work around
  it; behavior that depends on parallel groups is verified on real AWS.
- A consumer whose work lost a race (its conditional save finds that the
  state moved on) returns normally, so the message is acknowledged: the
  change that moved it raised its own event. Throw only for failures that a
  retry can fix.
- To record that retries were exhausted, bind a consumer to the dead-letter
  queue with `SqsConsumersModule.register`, like any queue.
- Use one SQS FIFO queue with a FIFO dead-letter queue per consumer.
  Provision it by adding a `consumer_queue <name> '<event pattern>'` line to
  `infra/floci/init/provision.sh` (it creates `<name>.fifo` and
  `<name>-dlq.fifo`), and add both URLs to `.env.example`.

## Boundaries

- Never publish directly from a use case.
- Never write `outbox_events` directly; record through `DomainEventRecorder`
  and let `UnitOfWork` flush. Only `BaseRepository` hands aggregate events to
  the recorder and calls `markPersisted()`.
- Run every writing entry point (requests, consumers, jobs, scripts) inside
  `UnitOfWork.run()`; reads may skip it.
- Do not share internal domain-event classes as public wire contracts between
  contexts; translate to explicit versioned integration contracts when needed.
- The deployable app selects active pollers and consumers. Importing unrelated
  persistence or authentication modules must not start background work.
- Long-running servers may schedule polling. Lambda and worker hosts use an
  invocation model appropriate to their trigger.
- Keep reusable messaging infrastructure under capability-first paths in
  `shared/infrastructure/src/lib/messaging`: `outbox` (poller and
  `MessageBroker` port), `eventbridge` (publishing adapter), `consumers`
  (`EventDispatcher` and `@OnEvent`), and `sqs` (listener and host module).
  Transport-specific code stays in `eventbridge` and `sqs`.

Use `$investflow-domain-application` for aggregate emission and listener use
cases. Use `$investflow-nestjs-infrastructure` for provider registration,
persistence adapters, and host composition.

## Tests

Cover atomic aggregate/outbox persistence, serialization, EventBridge routing,
publication marking and per-event failure isolation, processed-event
deduplication per consumer, consumer rollback, message deletion rules, and host
activation boundaries. `messaging.integration.spec.ts` covers the whole path
against Floci when `MESSAGING_TEST_DATABASE_URL` is set; run it with
`NODE_OPTIONS=--experimental-vm-modules` and without `AWS_PROFILE`. Run the affected project
tests and builds; broaden to `pnpm check` when shared messaging infrastructure
or Nx boundaries change.
