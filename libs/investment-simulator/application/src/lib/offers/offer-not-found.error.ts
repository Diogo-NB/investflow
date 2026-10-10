import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class OfferNotFoundError extends NotFoundError {
  constructor(offerId: string) {
    super('Esta oferta não está mais disponível.', {
      code: EAppErrorCode.OFFER_NOT_FOUND,
      metadata: { offerId },
    });
  }
}
