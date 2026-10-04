import type { UtcInstant } from '../dates/utc-instant.vo';

export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly eventType: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly context: string;
}
