import {
  RemunerationTerms,
  ETitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { CreateOfferUseCase } from './create-offer.use-case';

const ISSUER_NAME = 'Banco Local';

function createFixture() {
  const offerRepository = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as OfferRepository;

  return {
    useCase: new CreateOfferUseCase(offerRepository),
    offerRepository,
  };
}

describe('CreateOfferUseCase', () => {
  it('creates an offer without an issuer', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      titleType: ETitleType.CDB,
      issuerName: null,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
    });

    expect(result.isOk()).toBe(true);
    expect(fixture.offerRepository.save).toHaveBeenCalled();
  });

  it('saves the offer with its issuer name and returns its id', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      titleType: ETitleType.LCI,
      issuerName: ISSUER_NAME,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('105'),
      ),
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fixture.offerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.value.id,
        issuerName: ISSUER_NAME,
      }),
    );
  });

  it('propagates save failures', async () => {
    const fixture = createFixture();
    const error = new OfferNotFoundError('offer-id');
    jest
      .mocked(fixture.offerRepository.save)
      .mockResolvedValue(Result.err(error));

    const result = await fixture.useCase.execute({
      titleType: ETitleType.LCA,
      issuerName: ISSUER_NAME,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create('IPCA_PLUS', Rate.of('7.5')),
    });

    expect(result.error).toBe(error);
  });
});
