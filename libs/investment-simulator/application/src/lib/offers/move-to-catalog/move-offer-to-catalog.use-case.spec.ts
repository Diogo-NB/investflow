import {
  EOfferScope,
  OfferMovedToCatalog,
} from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { offerFixture, OTHER_USER, USER } from '../shared/offer-fixture';
import { MoveOfferToCatalogCommand } from './move-offer-to-catalog.command';
import { MoveOfferToCatalogUseCase } from './move-offer-to-catalog.use-case';

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new MoveOfferToCatalogUseCase(
    fixture.offerRepository,
    fixture.clock,
  );
  const move = (actor: string, offerId: string, revision = 1) =>
    useCase.execute(
      MoveOfferToCatalogCommand.fromRequest(actor, offerId, { revision }),
    );
  return { ...fixture, move };
}

describe('MoveOfferToCatalogUseCase', () => {
  it("moves the user's own terms to the catalog and saves the event", async () => {
    const { move, givenSimulationScoped, offerRepository } = setup();
    const offer = givenSimulationScoped(USER, 'base');
    let events: unknown[] = [];
    jest.mocked(offerRepository.save).mockImplementationOnce(async (saved) => {
      events = saved.getDomainEvents();
      return Result.ok(undefined);
    });

    const result = await move(USER, offer.id);

    expect(result.isOk()).toBe(true);
    expect(offer.scope).toBe(EOfferScope.CATALOG);
    expect(offer.basedOnOfferId).toBeNull();
    expect(events).toEqual([expect.any(OfferMovedToCatalog)]);
  });

  it.each([
    ["another user's offer", OTHER_USER, 1, EAppErrorCode.OFFER_NOT_FOUND],
    ['a stale revision', USER, 2, EAppErrorCode.OFFER_REVISION_CONFLICT],
  ])('rejects %s', async (_, actor, revision, code) => {
    const { move, givenSimulationScoped, offerRepository } = setup();
    const offer = givenSimulationScoped(USER, null);

    const result = await move(actor, offer.id, revision);

    expect(result.error.code).toBe(code);
    expect(offer.scope).toBe(EOfferScope.SIMULATION);
    expect(offerRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a system offer', async () => {
    const { move, given } = setup();

    const result = await move(USER, given(null).id);

    expect(result.error.code).toBe(EAppErrorCode.OFFER_READ_ONLY);
  });
});
