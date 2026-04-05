import { DomainEvent, InvestmentType } from '@investflow/shared-domain';
import Decimal from 'decimal.js';

export class ProductPublishedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'ProductPublished';
  readonly aggregateType = 'InvestmentProduct';
  readonly context = 'investflow-investments';
  readonly occurredAt: Date;

  constructor(
    readonly aggregateId: string,
    readonly organizationId: string,
    readonly type: InvestmentType,
    readonly rateValue: Decimal,
    readonly totalVolume: Decimal,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = occurredAt ?? new Date();
  }
}
