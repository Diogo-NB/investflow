export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly context: string;
}
