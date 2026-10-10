import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class OfferQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar as ofertas.', {
      code: EAppErrorCode.OFFER_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
