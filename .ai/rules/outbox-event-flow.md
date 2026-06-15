# Transactional Outbox And Event Consumers

## Publishing Flow

1. An aggregate raises an immutable `DomainEvent` through `apply()`.
2. A use case calls its repository's `save()` method.
3. `BaseRepository.save()` persists the aggregate and writes queued events to
   `outbox_events` in the active Prisma transaction.
4. `OutboxPollerService` publishes unpublished payloads to the SNS topic
   registered for each event's logical `context`.
5. The poller marks the outbox row published only after broker publication
   succeeds.

Each bounded-context infrastructure module owns its topic configuration and
registers it during module initialization:

```typescript
@Injectable()
export class ExampleTopicRegistration implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly topics: OutboxTopicRegistry,
  ) {}

  onModuleInit(): void {
    this.topics.register('example-context', this.config.getOrThrow<string>('SNS_EXAMPLE_TOPIC_ARN'));
  }
}
```

## Consumer Flow

Concrete consumers extend `SqsConsumerBase`, provide their queue URL, and
dispatch parsed event payloads to application use cases. The base class unwraps
SNS envelopes, records event IDs in `processed_events`, runs handling in a
Prisma transaction, deletes successful messages, and leaves failures for SQS
retry and DLQ handling.

## Invariants

- Never publish directly from a use case.
- Never read or clear aggregate events outside `BaseRepository`.
- Use the domain event ID for both outbox and processed-event identity.
- Treat delivery as at least once and keep consumers idempotent.
- Use one SNS topic per bounded context and one SQS queue per consumer.
- Each bounded context owns and registers its broker configuration.
