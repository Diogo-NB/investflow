import {
  OfferDetailsChanged,
  OfferTermsChanged,
} from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { offerFixture, OTHER_USER, USER } from '../shared/offer-fixture';
import { EditOfferCommand } from './edit-offer.command';
import { EditOfferUseCase } from './edit-offer.use-case';

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new EditOfferUseCase(fixture.offerRepository, fixture.clock);
  return { ...fixture, useCase };
}

describe('EditOfferUseCase', () => {
  it('converts only the supplied fields', () => {
    const command = EditOfferCommand.fromRequest(
      USER,
      { offerId: 'offer-id' },
      {
        revision: 3,
        issuerName: null,
        maturityDate: '2031-06-21',
        remunerationTerms: { kind: 'IPCA_PLUS', rate: '7.5' },
      },
    );

    expect(command.revision).toBe(3);
    expect(command.name).toBeUndefined();
    expect(command.issuerName).toBeNull();
    expect(command.maturityDate?.toIsoString()).toBe('2031-06-21');
    expect(command.redemptionTerms).toBeUndefined();
    expect(command.remunerationTerms?.kind).toBe('IPCA_PLUS');
    expect(command.remunerationTerms?.contractRate.value.toString()).toBe(
      '7.5',
    );
  });

  it('edits an own offer at its current revision and saves its change events', async () => {
    const { useCase, given, offerRepository } = setup();
    const offer = given(USER);
    let events: unknown[] = [];
    jest.mocked(offerRepository.save).mockImplementationOnce(async (saved) => {
      events = saved.getDomainEvents();
      return Result.ok(undefined);
    });

    const result = await useCase.execute(
      EditOfferCommand.fromRequest(
        USER,
        { offerId: offer.id },
        {
          revision: 1,
          name: 'CDB 120% do CDI',
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.2' },
        },
      ),
    );

    expect(result.isOk()).toBe(true);
    expect(offer.revision).toBe(2);
    expect(offer.name).toBe('CDB 120% do CDI');
    expect(offer.remunerationTerms.contractRate.value.toString()).toBe('1.2');
    expect(offer.issuerName).toBe('Banco Local');
    expect(events).toEqual([
      expect.any(OfferTermsChanged),
      expect.any(OfferDetailsChanged),
    ]);
  });

  it.each([
    [
      "another user's offer",
      USER as string | null,
      OTHER_USER,
      1,
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
    ['a system offer', null, USER, 1, EAppErrorCode.OFFER_READ_ONLY],
    ['a stale revision', USER, USER, 2, EAppErrorCode.OFFER_REVISION_CONFLICT],
  ])('rejects %s', async (_, owner, actor, revision, code) => {
    const { useCase, given, offerRepository } = setup();
    const offer = given(owner);

    const result = await useCase.execute(
      EditOfferCommand.fromRequest(
        actor,
        { offerId: offer.id },
        { revision, name: 'Outra' },
      ),
    );

    expect(result.error.code).toBe(code);
    expect(offer.name).toBe('CDB 110% do CDI');
    expect(offerRepository.save).not.toHaveBeenCalled();
  });

  it('saves nothing for a blank name', async () => {
    const { useCase, given, offerRepository } = setup();
    const offer = given(USER);

    const result = await useCase.execute(
      EditOfferCommand.fromRequest(
        USER,
        { offerId: offer.id },
        { revision: 1, name: ' ' },
      ),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVALID_OFFER);
    expect(offerRepository.save).not.toHaveBeenCalled();
  });
});
