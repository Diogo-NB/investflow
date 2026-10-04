import { ConflictError } from '@investflow/shared-domain';

export class OfferDeletedError extends ConflictError {
  constructor(offerId: string) {
    super(`Offer ${offerId} is deleted`, {
      code: 'OFFER_DELETED',
      metadata: { offerId },
    });
  }
}
