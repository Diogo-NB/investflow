export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly eventType: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly context: string;
}
