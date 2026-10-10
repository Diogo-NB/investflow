import { UpdateOfferCommand } from './update-offer.command';

const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

describe('UpdateOfferCommand', () => {
  it('creates a partial command', () => {
    const command = UpdateOfferCommand.fromRequest(
      { offerId: OFFER_ID },
      {
        maturityDate: '2031-06-21',
        remunerationTerms: { kind: 'IPCA_PLUS', rate: '7.5' },
      },
    );

    expect(command.offerId).toBe(OFFER_ID);
    expect(command.maturityDate?.toIsoString()).toBe('2031-06-21');
    expect(command.remunerationTerms?.kind).toBe('IPCA_PLUS');
    expect(command.remunerationTerms?.contractRate.value.toString()).toBe(
      '7.5',
    );
  });

  it('creates an empty command', () => {
    const command = UpdateOfferCommand.fromRequest({ offerId: OFFER_ID }, {});

    expect(command).toEqual({
      offerId: OFFER_ID,
      maturityDate: undefined,
      redemptionTerms: undefined,
      remunerationTerms: undefined,
    });
  });
});
