import { DomainEvent } from '@investflow/shared-domain';

export class ProductClosedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'ProductClosed';
  readonly aggregateType = 'InvestmentProduct';
  readonly context = 'investflow-investments';
  readonly occurredAt: Date;

  constructor(
    readonly aggregateId: string,
    readonly organizationId: string,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = occurredAt ?? new Date();
  }
}
