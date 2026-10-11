import { UtcInstant } from '@investflow/shared-domain';
import { InvestmentSimulatorEvent } from '../investment-simulator.event';

export class OfferCreated extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferCreated';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}

export class OfferChanged extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferChanged';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}

export class OfferDeleted extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferDeleted';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}
