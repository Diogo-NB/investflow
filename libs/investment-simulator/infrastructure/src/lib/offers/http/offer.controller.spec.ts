import {
  CreateOfferUseCase,
  DeleteOfferUseCase,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { TitleType } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';
import { CreateOfferRequest } from './requests/create-offer.request';
import { OfferIdRequest } from './requests/offer-id.request';
import { UpdateOfferRequest } from './requests/update-offer.request';
import { OfferController } from './offer.controller';

jest.mock('@investflow/shared-infrastructure', () => ({
  IsCalendarDate: () => () => undefined,
}));

const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const ISSUER_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

function createFixture() {
  const createOffer = {
    execute: jest.fn().mockResolvedValue(Result.ok({ id: OFFER_ID })),
  } as unknown as CreateOfferUseCase;
  const updateOffer = {
    execute: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as UpdateOfferUseCase;
  const deleteOffer = {
    execute: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as DeleteOfferUseCase;
  return {
    controller: new OfferController(createOffer, updateOffer, deleteOffer),
    createOffer,
    updateOffer,
    deleteOffer,
  };
}

describe('OfferController', () => {
  it('returns failed results unchanged for the HTTP interceptor', async () => {
    const fixture = createFixture();
    const error = new AppError('Offer not found', {
      code: 'OFFER_NOT_FOUND',
      kind: 'not-found',
    });
    const result = Result.err<void>(error);
    jest.mocked(fixture.deleteOffer.execute).mockResolvedValue(result);

    await expect(
      fixture.controller.delete({ offerId: OFFER_ID }),
    ).resolves.toBe(result);
  });

  it('creates an offer and preserves the decimal rate as a string', async () => {
    const fixture = createFixture();
    const request = Object.assign(new CreateOfferRequest(), {
      titleType: TitleType.LCI,
      issuerId: ISSUER_ID,
      maturityDate: '2030-05-20',
      redemptionTerms: { kind: 'DAILY' as const },
      remunerationTerms: {
        kind: 'CDI_PERCENTAGE' as const,
        rate: '105.12345678901234567890123456789',
      },
    });

    await expect(fixture.controller.create(request)).resolves.toEqual(
      Result.ok({
        id: OFFER_ID,
      }),
    );
    const command = jest.mocked(fixture.createOffer.execute).mock.calls[0][0];
    expect(command.maturityDate.toIsoString()).toBe('2030-05-20');
    expect(command.redemptionTerms.kind).toBe('DAILY');
    expect(command.remunerationTerms.kind).toBe('CDI_PERCENTAGE');
    expect(command.remunerationTerms.rate.value.toString()).toBe(
      '105.12345678901234567890123456789',
    );
  });

  it.each([
    ['PREFIXED', '12'],
    ['CDI_PERCENTAGE', '105'],
    ['SELIC_PERCENTAGE', '95'],
    ['IPCA_PLUS', '7.5'],
  ] as const)('maps %s remuneration', async (kind, rate) => {
    const fixture = createFixture();
    const request = Object.assign(new CreateOfferRequest(), {
      titleType: TitleType.CDB,
      issuerId: ISSUER_ID,
      maturityDate: '2030-05-20',
      redemptionTerms: { kind: 'AT_MATURITY' as const },
      remunerationTerms: { kind, rate },
    });

    await fixture.controller.create(request);

    const command = jest.mocked(fixture.createOffer.execute).mock.calls[0][0];
    expect(command.remunerationTerms.kind).toBe(kind);
    expect(command.remunerationTerms.rate.value.toString()).toBe(rate);
  });

  it('maps a partial update and returns the use-case result', async () => {
    const fixture = createFixture();
    const request = Object.assign(new UpdateOfferRequest(), {
      maturityDate: '2031-06-21',
      remunerationTerms: {
        kind: 'IPCA_PLUS' as const,
        rate: '7.5',
      },
    });

    await expect(
      fixture.controller.update({ offerId: OFFER_ID }, request),
    ).resolves.toEqual(Result.ok(undefined));
    expect(fixture.updateOffer.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        offerId: OFFER_ID,
        remunerationTerms: expect.objectContaining({ kind: 'IPCA_PLUS' }),
      }),
    );
  });

  it('accepts an empty update', async () => {
    const fixture = createFixture();

    await fixture.controller.update(
      { offerId: OFFER_ID },
      new UpdateOfferRequest(),
    );

    expect(fixture.updateOffer.execute).toHaveBeenCalledWith({
      offerId: OFFER_ID,
    });
  });

  it('deletes an offer and returns the use-case result', async () => {
    const fixture = createFixture();
    const params = Object.assign(new OfferIdRequest(), { offerId: OFFER_ID });

    await expect(fixture.controller.delete(params)).resolves.toEqual(
      Result.ok(undefined),
    );
    expect(fixture.deleteOffer.execute).toHaveBeenCalledWith({
      offerId: OFFER_ID,
    });
  });
});
