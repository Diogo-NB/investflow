import { UtcInstant } from '@investflow/shared-domain';
import { InvestmentSimulatorEvent } from '../investment-simulator.event';

export class OfferCreated extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferCreated';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}

export class OfferTermsChanged extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferTermsChanged';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}

export class OfferDetailsChanged extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferDetailsChanged';
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

// A simulation's own terms became an offer listed in Ofertas.
export class OfferMovedToCatalog extends InvestmentSimulatorEvent {
  readonly eventType = 'OfferMovedToCatalog';
  readonly aggregateType = 'Offer';

  constructor(offerId: string, occurredAt: UtcInstant) {
    super(offerId, occurredAt);
  }
}
