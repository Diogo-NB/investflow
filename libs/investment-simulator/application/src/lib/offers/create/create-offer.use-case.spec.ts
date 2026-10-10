import {
  RemunerationTerms,
  Issuer,
  ETitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, Result } from '@investflow/shared-domain';
import { IssuerNotFoundError } from '../../issuers/issuer-not-found.error';
import { IssuerRepository } from '../../issuers/issuer.repository';
import { OfferRepository } from '../offer.repository';
import { CreateOfferUseCase } from './create-offer.use-case';

const ISSUER_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

function createFixture() {
  const issuerRepository = {
    findById: jest
      .fn()
      .mockResolvedValue(
        Result.ok(Issuer.reconstitute({ id: ISSUER_ID, name: 'Bank' })),
      ),
    save: jest.fn(),
  } as unknown as IssuerRepository;
  const offerRepository = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as OfferRepository;

  return {
    useCase: new CreateOfferUseCase(issuerRepository, offerRepository),
    issuerRepository,
    offerRepository,
  };
}

describe('CreateOfferUseCase', () => {
  it('validates the issuer, saves the offer and returns its id', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      titleType: ETitleType.LCI,
      issuerId: ISSUER_ID,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('105'),
      ),
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fixture.issuerRepository.findById).toHaveBeenCalledWith(ISSUER_ID);
    expect(fixture.offerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.value.id }),
    );
  });

  it('returns issuer not found without creating the offer', async () => {
    const fixture = createFixture();
    const error = new IssuerNotFoundError(ISSUER_ID);
    jest
      .mocked(fixture.issuerRepository.findById)
      .mockResolvedValue(Result.err(error));

    const result = await fixture.useCase.execute({
      titleType: ETitleType.CDB,
      issuerId: ISSUER_ID,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
    });

    expect(result.error).toBe(error);
    expect(fixture.offerRepository.save).not.toHaveBeenCalled();
  });

  it('propagates save failures', async () => {
    const fixture = createFixture();
    const error = new IssuerNotFoundError(ISSUER_ID);
    jest
      .mocked(fixture.offerRepository.save)
      .mockResolvedValue(Result.err(error));

    const result = await fixture.useCase.execute({
      titleType: ETitleType.LCA,
      issuerId: ISSUER_ID,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create('IPCA_PLUS', Rate.of('7.5')),
    });

    expect(result.error).toBe(error);
  });
});
