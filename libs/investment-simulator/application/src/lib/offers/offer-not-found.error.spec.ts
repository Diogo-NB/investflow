import { OfferNotFoundError } from './offer-not-found.error';

describe('OfferNotFoundError', () => {
  it('describes a missing offer', () => {
    const error = new OfferNotFoundError('offer-id');

    expect(error.code).toBe('OFFER_NOT_FOUND');
    expect(error.kind).toBe('not-found');
    expect(error.metadata).toEqual({ offerId: 'offer-id' });
  });
});
