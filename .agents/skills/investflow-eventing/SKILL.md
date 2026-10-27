---
name: investflow-eventing
description: Own InvestFlow domain events end to end, from deciding which business facts become events to delivering them. Use whenever a change adds, renames, removes, or changes a domain event or its payload; makes an aggregate, use case, or service raise or record an event; adds or changes a consumer, queue, or routing rule; or touches the outbox, relay, poller, publisher, unit-of-work commit hooks, EventBridge, SQS, retries, dead-letter queues, or idempotency. Load it alongside the domain or infrastructure skill when their work raises or consumes events. Do not use for changes that neither raise nor consume events.
---

# InvestFlow Eventing

This skill is the single owner of domain events: which facts become events,
what they carry, who consumes them, and how they are delivered. It preserves
atomic event persistence and at-least-once delivery across bounded contexts.
`docs/architecture/event-flow.md` walks through the whole flow with diagrams;
its "Event Catalog" lists every event, its producer, and its consumers.

## Event design

Read the "Event Catalog" and "Adding or Changing an Event" sections of
`docs/architecture/event-flow.md` before adding or changing an event, and
update the catalog in the same change.

- Name each event after the business fact, in the past tense, never a
  generic `<Aggregate>Changed` or `<Aggregate>Updated`. Split an aggregate's
  changes into separate events when consumers must react differently to
  them: an offer's terms change recalculates simulations while a renamed
  offer does not, so they are `OfferTermsChanged` and `OfferDetailsChanged`.
  Consumers subscribe to the facts they care about instead of filtering a
  generic event.
- Do not encode an operation's mode in one event when the facts differ:
  creating, editing, and asking for a calculation are `SimulationCreated`,
  `SimulationEdited`, and `SimulationCalculationRequested`, and one consumer
  subscribes to all three.
- Keep payloads minimal. Consumers read current state, so an event carries
  identifiers and only the fields a consumer needs and cannot read. Do not
  copy aggregate state (owner, name, revision, values) into it "in case".
- Events are immutable, versioned classes with event identity, `occurredAt`
  as `UtcInstant`, aggregate identity and type, the logical context, and
  scalar payload data. No entities, value objects, or ORM objects.
- Aggregates raise events through `apply()` from their behavior; services
  record bulk events through `DomainEventRecorder` (see "Publishing flow").

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
   when it is recorded and buffers the rows per unit of work. Recording
   outside a unit of work throws, because the event would be lost. On the
   first event of a unit of work it registers two hooks on its scope:
   - a **before-commit** hook that stamps `created_at` and appends the rows
     to `outbox_events` in chunks of 1,000, so changes and their events
     commit together or not at all;
   - an **after-commit** hook that hands the rows to `OutboxRelay`, when the
     host imports `OutboxModule` (the recorder injects it optionally).
     Rows of one transaction share `created_at` and publish in no particular
     order. The writer owns the row format, serialization, and payload limit,
     so the outbox table is touched only in `messaging/outbox`.
4. `UnitOfWork.run()` runs the before-commit hooks inside the transaction (a
   failure rolls it back) and the after-commit hooks once committed, outside
   any unit of work, logging their failures. Register one from
   infrastructure code with `UnitOfWork.afterCommit(hook)`. After-commit hooks
   are best effort and infrastructure only; anything that must happen after a
   change is a domain event, never a hook.
5. `OutboxRelay` publishes the rows on the next turn of the event loop, so the
   response never waits for the broker. It holds at most 5,000 rows, drops
   rows that waited 2.5 s, skips everything while publishing is paused, and
   coalesces marks into one `UPDATE` at a time. Anything it does not mark
   published is left to the poller. On shutdown it waits up to 5 s for its
   calls in flight.
6. `OutboxPublisher` is the only code that calls the `MessageBroker` port:
   batches of at most `MAX_BATCH_MESSAGES` (10) and `MAX_BATCH_BYTES`, at most
   8 calls in flight across the relay and the poller, a 2 s timeout per call
   through an `AbortSignal`, bulk marks, and per-event exponential backoff
   (`attempts`, `nextAttemptAt` up to 5 minutes, `lastError`) for rejected
   messages and failed calls. Three consecutive failed calls pause
   publishing (1 s, doubling to 60 s while the broker stays down); a success
   resumes it. Adapters must not retry: the outbox owns retries.
   `OutboxPollerService` is the fallback: every second, and again at once
   while batches come back full, it claims up to 100 rows that are due or
   older than the grace period (the relay's 2.5 s plus the call timeout plus
   a margin, 5 s) with `FOR UPDATE SKIP LOCKED`, publishes them, and marks
   them through the claiming transaction. Any number of processes can poll
   one outbox. A process that stops between publishing and marking causes a
   republish; consumers deduplicate.
7. `OutboxWriter` rejects an event whose payload exceeds the outbox limit
   (200 KB) at `record()`. `BaseRepository.save()` lets that failure throw
   rather than return an error, so the whole unit of work rolls back with
   nothing written. The limit is the outbox's own contract: events carry
   identifiers and changed fields, not documents, and every broker adapter
   must accept payloads of that size.

Routing lives in the broker adapter and the EventBridge rules; the outbox and
the port know no topics, buses, or queues. The deployable host decides whether
it publishes (relay and poller) by importing `OutboxModule`; a host without it
leaves its events to a publishing host's poller. Measure publishing latency
with `investflow-outbox-benchmark` before and after changing publishing.

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
- Design for real AWS semantics. When Floci does not emulate a feature the
  design needs, document the gap here and keep the design; do not shape it
  around the emulator. Ask the user when a behavior must be verified on real
  AWS.
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
  and let its before-commit hook write the rows. Only `BaseRepository` hands aggregate events to
  the recorder and calls `markPersisted()`.
- Run every writing entry point (requests, consumers, jobs, scripts) inside
  `UnitOfWork.run()`; reads may skip it.
- Do not share internal domain-event classes as public wire contracts between
  contexts; translate to explicit versioned integration contracts when needed.
- The deployable app selects active publishing (`OutboxModule`) and consumers. Importing unrelated
  persistence or authentication modules must not start background work.
- Long-running servers run the relay and the polling loop. Lambda and worker
  hosts use an invocation model appropriate to their trigger; a Lambda that
  records events must await the relay before returning or rely on another
  host's poller.
- Keep reusable messaging infrastructure under capability-first paths in
  `shared/infrastructure/src/lib/messaging`: `outbox` (writer, recorder,
  relay, publisher, poller, and `MessageBroker` port), `eventbridge` (publishing adapter), `consumers`
  (`EventDispatcher` and `@OnEvent`), and `sqs` (listener and host module).
  Transport-specific code stays in `eventbridge` and `sqs`.

Use `investflow-domain-application` for the aggregate behavior and use cases
around an event, and `investflow-nestjs-infrastructure` for provider
registration, persistence adapters, and host composition.

## Before finishing

- Every new or changed event is in the "Event Catalog", with its producer,
  payload, and consumers.
- Each event names one business fact; no generic `Changed` event and no mode
  field.
- Each payload field is read by a consumer and cannot be read from current
  state.
- Each consumed event is in its queue's pattern in
  `infra/floci/init/provision.sh` and has an `@OnEvent` method.
- Consumers are idempotent, read current state, and throw only for failures
  a retry can fix.

## Tests

Cover atomic aggregate/outbox persistence, commit hooks (order, rollback,
after-commit only on success and outside the scope), serialization,
EventBridge routing and rejected entries, batching and the in-flight limit,
the relay's hand-off, cap, staleness, and shutdown, the poller's claim and
grace period, publication marking and per-event failure isolation, pausing, processed-event
deduplication per consumer, consumer rollback, message deletion rules, and host
activation boundaries. `messaging.integration.spec.ts` covers the whole path
against Floci, including concurrent pollers; it runs in
`pnpm check:integration`. Finish with the checks for eventing in "Done means" in
`AGENTS.md`.
