---
name: investflow-eventing
description: Own InvestFlow domain events end to end, from deciding which business facts become events to delivering them. Use whenever a change adds, renames, removes, or changes a domain event or its payload; makes an aggregate, use case, or service raise or record an event; adds or changes a consumer, queue, or routing rule; or touches the outbox, relay, poller, publisher, unit-of-work commit hooks, EventBridge, SQS, retries, dead-letter queues, or idempotency. Load it alongside the domain or infrastructure skill when their work raises or consumes events. Do not use for changes that neither raise nor consume events.
---

# InvestFlow Eventing

This skill is the single owner of domain events: which facts become events,
what they carry, who consumes them, and how they are delivered. It preserves
atomic event persistence and at-least-once delivery across bounded contexts.

## Start

- Adding or changing an event: read "Event Catalog" and "Adding or Changing
  an Event" in `docs/architecture/event-flow.md`.
- Changing recording, publishing, routing, or consumption: read
  `docs/architecture/messaging.md`, which owns how the outbox, relay, poller,
  queues, and hosts work and the reasons behind their numbers (buffer sizes,
  timeouts, batch limits). Change a number there, never in a second place.
- Changing what recalculates when: read `docs/architecture/recalculation.md`
  and walkthroughs 5 and 6 in `event-flow.md`.

## Event design

- Name each event after the business fact, in the past tense, never a
  generic `<Aggregate>Changed` or `<Aggregate>Updated`. Split an aggregate's
  changes into separate events when consumers react differently to them: an
  offer's terms change recalculates simulations while a renamed offer does
  not, so they are `OfferTermsChanged` and `OfferDetailsChanged`.
- Do not encode an operation's mode in one event when the facts differ:
  creating, editing, and asking for a calculation are `SimulationCreated`,
  `SimulationEdited`, and `SimulationCalculationRequested`, and one consumer
  subscribes to all three.
- Keep payloads minimal. Consumers read current state, so an event carries
  identifiers and only the fields a consumer needs and cannot read. Do not
  copy aggregate state (owner, name, revision, values) into it "in case".
- Events are immutable, versioned classes with event identity, `occurredAt`
  as `UtcInstant`, aggregate identity and type, the logical context, and
  scalar payload data; no entities, value objects, or ORM objects. Changing
  an existing payload is a new `version`.
- Use the event ID as the outbox identity and the processed-event identity.
  Route on the logical context name, never a deployment name.
- Do not share internal domain-event classes as wire contracts between
  contexts; translate to explicit versioned integration contracts.
- Update the Event Catalog in the same change.

## Recording and publishing

- Aggregates raise events with `apply()` from their behavior;
  `BaseRepository.save()` hands them to `DomainEventRecorder` and calls
  `markPersisted()`. Domain and application services inject
  `DomainEventRecorder` and call `record(...events)` for bulk work that loads
  no aggregates, such as fan-out pages.
- Every writing entry point (requests, consumers, jobs, scripts) runs inside
  `UnitOfWork.run()`; recording outside one throws. Reads may skip it.
- Never publish from a use case and never write `outbox_events` directly:
  the recorder's before-commit hook writes the rows, and only
  `messaging/outbox` touches that table.
- An event over the outbox payload limit fails at `record()` and rolls the
  unit of work back. The limit is the outbox's own contract; events carry
  identifiers, not documents.
- After-commit hooks (`UnitOfWork.afterCommit()`) are best effort and
  infrastructure only; anything that must happen after a change is a domain
  event.
- `OutboxPublisher` is the only caller of the `MessageBroker` port. Adapters
  never retry: the outbox owns retries, timeouts, and pausing.
- The host decides whether it publishes by importing `OutboxModule`; one
  without it leaves its events to a publishing host's poller. A Lambda that
  records events awaits the relay before returning or relies on another
  host's poller.
- Measure with `investflow-outbox-benchmark` before and after changing the
  publishing path.

## Consumers

- A consumer is a plain `@Injectable()` class in its context's
  infrastructure, provided by the module that owns its dependencies, with one
  `@OnEvent('EventType')` method per event, each calling a use case. It knows
  nothing about SQS or EventBridge. Consumer class names are unique.
- `EventDispatcher` records `(consumer, event ID)` in `processed_events` in
  the handler's transaction, so duplicates are skipped and a failure rolls the
  record back. Make effects idempotent anyway and read current state.
- Leave delivery mechanics to the queue: visibility timeout, redelivery, and
  the dead-letter queue. Never add leases, claims, or retry counters to
  domain or application code.
- Queues are SQS FIFO grouped by `$.detail.aggregateId`, so one message per
  aggregate is in flight at a time. Rely on that exclusivity, never on
  delivery order; do not add generation counters or per-input conditions.
  Handle messages of one group sequentially and finish within the
  visibility timeout or extend it.
- A consumer whose work lost a race (its conditional save finds the state
  moved on) returns normally: the change that moved it raised its own event.
  Throw only for failures a retry can fix.
- Add a queue with a `consumer_queue <name> '<event pattern>'` line in
  `infra/floci/init/provision.sh` (it creates `<name>.fifo` and
  `<name>-dlq.fifo`), add both URLs to `.env.example`, and bind the consumer
  in the host with `SqsConsumersModule.register([{ consumer,
queueUrlConfigKey }])`. A dead-letter consumer is bound the same way.
- Design for real AWS semantics. Floci enforces FIFO groups but not the
  dynamic group path, so locally every queue runs serially; do not work
  around it. When a behavior can only be confirmed on real AWS, say so and
  ask the user.

## Placement

Reusable messaging code lives under
`shared/infrastructure/src/lib/messaging`: `outbox` (writer, recorder, relay,
publisher, poller, `MessageBroker` port), `eventbridge`, `consumers`
(`EventDispatcher`, `@OnEvent`), and `sqs`. Transport-specific code stays in
`eventbridge` and `sqs`. Importing persistence or authentication modules must
never start background work.

## Before finishing

- Every new or changed event is in the Event Catalog, with its producer,
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

Cover atomic aggregate and outbox persistence, commit hooks (order,
rollback, after-commit only on success and outside the scope), serialization
and the payload limit, routing and rejected entries, batching and the
in-flight limit, the relay's hand-off, cap, staleness, and shutdown, the
poller's claim and grace period, per-event failure isolation, pausing,
processed-event deduplication, consumer rollback, message deletion, and host
activation. `messaging.integration.spec.ts` covers the whole path against
Floci and runs in `pnpm check:integration`. Finish with the checks for
eventing in "Done means" in `AGENTS.md`.
