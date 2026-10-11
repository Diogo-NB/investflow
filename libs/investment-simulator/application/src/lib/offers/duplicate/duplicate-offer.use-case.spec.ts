import { EAppErrorCode } from '@investflow/shared-domain';
import { offerFixture, OTHER_USER, USER } from '../shared/offer-fixture';
import { DuplicateOfferCommand } from './duplicate-offer.command';
import { DuplicateOfferUseCase } from './duplicate-offer.use-case';

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new DuplicateOfferUseCase(
    fixture.offerRepository,
    fixture.clock,
  );
  return { ...fixture, useCase };
}

describe('DuplicateOfferUseCase', () => {
  it.each([null, USER])(
    "copies an offer owned by %s into the user's private copy",
    async (owner) => {
      const { useCase, given, offers } = setup();
      const source = given(owner);

      const result = await useCase.execute(
        DuplicateOfferCommand.fromRequest(USER, { offerId: source.id }),
      );

      const copy = offers.get(result.value.offerId);
      expect(copy?.id).not.toBe(source.id);
      expect(copy?.ownerId).toBe(USER);
      expect(copy?.name).toBe('CDB 110% do CDI (cópia)');
      expect(copy?.remunerationTerms).toBe(source.remunerationTerms);
    },
  );

  it("treats another user's offer as missing", async () => {
    const { useCase, given, offerRepository } = setup();
    const source = given(OTHER_USER);

    const result = await useCase.execute(
      DuplicateOfferCommand.fromRequest(USER, { offerId: source.id }),
    );

    expect(result.error.code).toBe(EAppErrorCode.OFFER_NOT_FOUND);
    expect(offerRepository.save).not.toHaveBeenCalled();
  });
});
