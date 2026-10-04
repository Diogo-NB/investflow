import { NotFoundError } from '@investflow/shared-domain';

export class OfferNotFoundError extends NotFoundError {
  constructor(offerId: string) {
    super(`Offer ${offerId} was not found`, {
      code: 'OFFER_NOT_FOUND',
      metadata: { offerId },
    });
  }
}
