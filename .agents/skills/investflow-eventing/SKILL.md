---
name: investflow-eventing
description: Implement, review, or refactor InvestFlow transactional messaging. Use for domain events, outbox persistence or polling, SNS topic routing, SQS consumers, processed-event tracking, retries, dead-letter behavior, idempotency, or host activation of messaging workers. Do not use for backend changes without event publication or consumption.
---

# InvestFlow Eventing

Preserve atomic event persistence and at-least-once delivery across bounded
contexts.

## Publishing flow

1. An aggregate raises an immutable, past-tense `DomainEvent` through `apply()`.
2. A use case calls its command repository's `save()` method.
3. `BaseRepository.save()` persists the aggregate and its queued events to
   `outbox_events` in the active Prisma transaction.
4. `OutboxPollerService` publishes unpublished payloads to the SNS topic
   registered for the event's logical context.
5. The poller marks an outbox row as published only after broker publication
   succeeds.

Each bounded context owns its topic registration. Importing the publishing
context module makes that registration available, while the deployable host
decides whether an outbox poller is active.

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

- Concrete consumers extend `SqsConsumerBase`, provide their queue URL, and
  dispatch parsed payloads to application use cases.
- The base consumer unwraps SNS envelopes, records the event ID in
  `processed_events`, handles the event in a Prisma transaction, and deletes
  the message only after successful processing.
- Treat delivery as at least once. Make consumer effects idempotent and leave
  failed messages available for SQS retry and dead-letter handling.
- Use one SNS topic per bounded context and one SQS queue per consumer.

## Boundaries

- Never publish directly from a use case.
- Never read or clear aggregate events outside `BaseRepository`.
- Do not share internal domain-event classes as public wire contracts between
  contexts; translate to explicit versioned integration contracts when needed.
- The deployable app selects active pollers and consumers. Importing unrelated
  persistence or authentication modules must not start background work.
- Long-running servers may schedule polling. Lambda and worker hosts use an
  invocation model appropriate to their trigger.

Use `$investflow-domain-application` for aggregate emission and listener use
cases. Use `$investflow-nestjs-infrastructure` for provider registration,
persistence adapters, and host composition.

## Tests

Cover atomic aggregate/outbox persistence, serialization, topic routing,
successful publication marking, retry behavior, processed-event deduplication,
consumer rollback, and host activation boundaries. Run the affected project
tests and builds; broaden to `pnpm check` when shared messaging infrastructure
or Nx boundaries change.
