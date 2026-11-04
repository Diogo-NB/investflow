import {
  DomainEvent,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';

export abstract class MarketDataEvent implements DomainEvent {
  readonly eventId = generateUuid();
  readonly version: number = 1;
  readonly context = 'market-data';
  abstract readonly eventType: string;
  abstract readonly aggregateType: string;

  protected constructor(
    readonly aggregateId: string,
    readonly occurredAt: UtcInstant,
  ) {}
}
