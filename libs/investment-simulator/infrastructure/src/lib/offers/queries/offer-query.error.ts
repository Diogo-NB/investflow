import { AppError } from '@investflow/shared-domain';

export class OfferQueryError extends AppError {
  constructor(cause: unknown) {
    super('Failed to read offers', {
      code: 'OFFER_QUERY_FAILED',
      kind: 'infrastructure',
      cause,
    });
  }
}
