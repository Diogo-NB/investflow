import { DomainError } from '@investflow/shared-domain';

export class ImmutableOfferSnapshotError extends DomainError {
  constructor(offerId: string) {
    super('Offer snapshots cannot be changed or deleted', {
      code: 'IMMUTABLE_OFFER_SNAPSHOT',
      kind: 'conflict',
      metadata: { offerId },
    });
  }
}

export class InvalidOfferSnapshotError extends DomainError {
  constructor(offerId: string) {
    super('Cannot create a snapshot from a deleted offer', {
      code: 'INVALID_OFFER_SNAPSHOT',
      metadata: { offerId },
    });
  }
}
