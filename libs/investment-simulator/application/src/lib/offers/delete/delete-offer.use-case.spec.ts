import {
  RemunerationTerms,
  Offer,
  ETitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  CalendarDate,
  Rate,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { DeleteOfferUseCase } from './delete-offer.use-case';

const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const NOW = UtcInstant.ofIso('2026-09-28T15:00:00Z');

function createFixture() {
  const offer = Offer.reconstitute({
    deletedAt: null,
    id: OFFER_ID,
    titleType: ETitleType.CDB,
    issuerId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
    maturityDate: CalendarDate.of('2030-05-20'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
  });
  const repository = {
    findById: jest.fn().mockResolvedValue(Result.ok(offer)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as OfferRepository;
  const clock = { now: jest.fn(() => NOW) } as unknown as Clock;
  return {
    useCase: new DeleteOfferUseCase(repository, clock),
    repository,
    clock,
    offer,
  };
}

describe('DeleteOfferUseCase', () => {
  it('soft deletes at the current instant and saves', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({ offerId: OFFER_ID });

    expect(result.isOk()).toBe(true);
    expect(fixture.clock.now).toHaveBeenCalledTimes(1);
    expect(fixture.offer.deletedAt).toBe(NOW);
    expect(fixture.repository.save).toHaveBeenCalledWith(fixture.offer);
  });

  it('returns not found without reading the clock or saving', async () => {
    const fixture = createFixture();
    const error = new OfferNotFoundError(OFFER_ID);
    jest
      .mocked(fixture.repository.findById)
      .mockResolvedValue(Result.err(error));

    const result = await fixture.useCase.execute({ offerId: OFFER_ID });

    expect(result.error).toBe(error);
    expect(fixture.clock.now).not.toHaveBeenCalled();
    expect(fixture.repository.save).not.toHaveBeenCalled();
  });

  it('propagates save failures', async () => {
    const fixture = createFixture();
    const error = new OfferNotFoundError(OFFER_ID);
    jest.mocked(fixture.repository.save).mockResolvedValue(Result.err(error));

    const result = await fixture.useCase.execute({ offerId: OFFER_ID });

    expect(result.error).toBe(error);
  });
});
