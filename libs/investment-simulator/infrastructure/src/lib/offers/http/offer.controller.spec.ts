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
import { ListOffersQueryHandler } from '../queries/list-offers.query-handler';
import {
  GetOfferOutput,
  GetOfferQueryHandler,
} from '../queries/get-offer.query-handler';
import { ListOffersRequest } from './requests/list-offers.request';

jest.mock('@investflow/shared-infrastructure', () => ({
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
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
  const offer: GetOfferOutput = {
    id: OFFER_ID,
    titleType: TitleType.CDB,
    issuer: { id: ISSUER_ID, name: 'Banco Local' },
    maturityDate: '2028-12-31',
    redemptionTerms: { kind: 'DAILY' },
    remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
  };
  const listResult = Result.ok({
    items: [offer],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  const getResult = Result.ok(offer);
  const listOffers = {
    execute: jest.fn().mockResolvedValue(listResult),
  } as unknown as ListOffersQueryHandler;
  const getOffer = {
    execute: jest.fn().mockResolvedValue(getResult),
  } as unknown as GetOfferQueryHandler;
  return {
    controller: new OfferController(
      createOffer,
      updateOffer,
      deleteOffer,
      listOffers,
      getOffer,
    ),
    createOffer,
    updateOffer,
    deleteOffer,
    listOffers,
    getOffer,
    listResult,
    getResult,
  };
}

describe('OfferController', () => {
  it('delegates reads and returns query results unchanged for the HTTP interceptor', async () => {
    const fixture = createFixture();
    const query = new ListOffersRequest();
    const page = await fixture.controller.list(query);
    expect(fixture.listOffers.execute).toHaveBeenCalledWith(query);
    expect(page).toBe(fixture.listResult);
    const details = await fixture.controller.get({ offerId: OFFER_ID });
    expect(fixture.getOffer.execute).toHaveBeenCalledWith({
      offerId: OFFER_ID,
    });
    expect(details).toBe(fixture.getResult);
  });
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
