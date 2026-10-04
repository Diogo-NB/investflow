import {
  RemunerationTerms,
  Offer,
  TitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { UpdateOfferUseCase } from './update-offer.use-case';

const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function offer() {
  return Offer.reconstitute({
    deletedAt: null,
    id: OFFER_ID,
    titleType: TitleType.CDB,
    issuerId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
    maturityDate: CalendarDate.of('2030-05-20'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
  });
}

function createFixture(loadedOffer = offer()) {
  const repository = {
    findById: jest.fn().mockResolvedValue(Result.ok(loadedOffer)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as OfferRepository;
  return {
    useCase: new UpdateOfferUseCase(repository),
    repository,
    offer: loadedOffer,
  };
}

describe('UpdateOfferUseCase', () => {
  it('updates every supplied mutable condition and saves once', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      offerId: OFFER_ID,
      maturityDate: CalendarDate.of('2031-06-21'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'SELIC_PERCENTAGE',
        Rate.of('95'),
      ),
    });

    expect(result.isOk()).toBe(true);
    expect(fixture.offer.maturityDate.toIsoString()).toBe('2031-06-21');
    expect(fixture.offer.redemptionTerms).toEqual(
      RedemptionTerms.create('DAILY'),
    );
    expect(fixture.offer.remunerationTerms).toEqual(
      RemunerationTerms.create('SELIC_PERCENTAGE', Rate.of('95')),
    );
    expect(fixture.repository.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    {
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12.0')),
    },
  ])('saves the offer for an empty or identical update', async (changes) => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      offerId: OFFER_ID,
      ...changes,
    });

    expect(result.isOk()).toBe(true);
    expect(fixture.repository.save).toHaveBeenCalledTimes(1);
    expect(fixture.repository.save).toHaveBeenCalledWith(fixture.offer);
  });

  it('propagates lookup and save failures', async () => {
    const lookupFixture = createFixture();
    const lookupError = new OfferNotFoundError(OFFER_ID);
    jest
      .mocked(lookupFixture.repository.findById)
      .mockResolvedValue(Result.err(lookupError));

    const lookupResult = await lookupFixture.useCase.execute({
      offerId: OFFER_ID,
      maturityDate: CalendarDate.of('2031-01-01'),
    });

    expect(lookupResult.error).toBe(lookupError);
    expect(lookupFixture.repository.save).not.toHaveBeenCalled();

    const saveFixture = createFixture();
    const saveError = new OfferNotFoundError(OFFER_ID);
    jest
      .mocked(saveFixture.repository.save)
      .mockResolvedValue(Result.err(saveError));

    const saveResult = await saveFixture.useCase.execute({
      offerId: OFFER_ID,
      maturityDate: CalendarDate.of('2031-01-01'),
    });

    expect(saveResult.error).toBe(saveError);
  });
});
