import { EAppErrorCode } from '@investflow/shared-domain';
import { offerFixture, OTHER_USER, USER } from '../shared/offer-fixture';
import { DeleteOfferCommand } from './delete-offer.command';
import { DeleteOfferUseCase } from './delete-offer.use-case';

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new DeleteOfferUseCase(
    fixture.offerRepository,
    fixture.clock,
  );
  return { ...fixture, useCase };
}

describe('DeleteOfferUseCase', () => {
  it.each([USER, null])('deletes an offer owned by %s', async (owner) => {
    const { useCase, given } = setup();
    const offer = given(owner);

    const result = await useCase.execute(
      DeleteOfferCommand.fromRequest(owner, { offerId: offer.id }),
    );

    expect(result.isOk()).toBe(true);
    expect(offer.deletedAt).not.toBeNull();
    expect(offer.revision).toBe(2);
  });

  it.each([
    ['a system offer by a user', null, USER, EAppErrorCode.OFFER_READ_ONLY],
    [
      "another user's offer",
      USER as string | null,
      OTHER_USER,
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
  ])('refuses %s', async (_, owner, actor, code) => {
    const { useCase, given, offerRepository } = setup();
    const offer = given(owner);

    const result = await useCase.execute(
      DeleteOfferCommand.fromRequest(actor, { offerId: offer.id }),
    );

    expect(result.error.code).toBe(code);
    expect(offer.deletedAt).toBeNull();
    expect(offerRepository.save).not.toHaveBeenCalled();
  });
});
