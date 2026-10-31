import {
  EOfferScope,
  ETitleType,
  OfferCreated,
} from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { offerFixture, OTHER_USER, USER } from '../shared/offer-fixture';
import { CreateSimulationScopedOfferCommand } from './create-simulation-scoped-offer.command';
import { CreateSimulationScopedOfferUseCase } from './create-simulation-scoped-offer.use-case';

const TERMS = {
  titleType: ETitleType.CDB,
  maturityDate: '2028-12-29',
  redemptionTerms: { kind: 'AT_MATURITY' as const },
  remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate: '1.15' },
};

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new CreateSimulationScopedOfferUseCase(
    fixture.offerRepository,
    fixture.clock,
  );
  const create = (basedOnOfferId?: string) =>
    useCase.execute(
      CreateSimulationScopedOfferCommand.fromRequest(USER, {
        ...TERMS,
        basedOnOfferId,
      }),
    );
  return { ...fixture, create };
}

describe('CreateSimulationScopedOfferUseCase', () => {
  it('saves own terms based on an offer the user can choose', async () => {
    const { create, given, offers } = setup();
    const base = given(null);

    const result = await create(base.id);

    const created = offers.get(result.value.offerId);
    expect(created?.scope).toBe(EOfferScope.SIMULATION);
    expect(created?.basedOnOfferId).toBe(base.id);
    expect(created?.ownerId).toBe(USER);
    expect(created?.remunerationTerms.contractRate.value.toString()).toBe(
      '1.15',
    );
  });

  it('saves own terms typed from scratch without a base', async () => {
    const { create, offerRepository, offers } = setup();
    let events: unknown[] = [];
    jest.mocked(offerRepository.save).mockImplementationOnce(async (saved) => {
      events = saved.getDomainEvents();
      offers.set(saved.id, saved);
      return Result.ok(undefined);
    });

    const result = await create();

    expect(result.isOk()).toBe(true);
    expect(events).toEqual([expect.any(OfferCreated)]);
  });

  it.each([
    ["another user's offer", (f: ReturnType<typeof setup>) => f.given(OTHER_USER)],
    [
      "another simulation's own terms",
      (f: ReturnType<typeof setup>) => f.givenSimulationScoped(USER, null),
    ],
  ])('rejects a base that is %s', async (_, base) => {
    const fixture = setup();

    const result = await fixture.create(base(fixture).id);

    expect(result.error.code).toBe(EAppErrorCode.OFFER_NOT_FOUND);
    expect(fixture.offerRepository.save).not.toHaveBeenCalled();
  });
});
