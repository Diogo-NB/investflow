import { ETitleType } from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { CreateOfferCommandInput } from '../../shared/offer-command-input.type';
import { offerFixture, USER } from '../../shared/offer-fixture';
import { CreateOfferCommand } from '../create-offer.command';
import { CreateOfferUseCase } from '../create-offer.use-case';

function command(
  overrides: Partial<CreateOfferCommandInput> = {},
  actorId: string | null = USER,
) {
  return CreateOfferCommand.fromRequest(actorId, {
    titleType: ETitleType.LCI,
    name: 'LCI prefixada',
    maturityDate: '2030-05-20',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
    ...overrides,
  });
}

function setup() {
  const fixture = offerFixture(jest.fn);
  const useCase = new CreateOfferUseCase(
    fixture.offerRepository,
    fixture.clock,
  );
  return { ...fixture, useCase };
}

describe('CreateOfferUseCase', () => {
  it.each([USER, null])(
    'saves an offer owned by %s with its creation event',
    async (actorId) => {
      const { useCase, offers, offerRepository } = setup();
      const savedEvents: string[] = [];
      jest
        .mocked(offerRepository.save)
        .mockImplementationOnce(async (offer) => {
          savedEvents.push(...offer.getDomainEvents().map((e) => e.eventType));
          offers.set(offer.id, offer);
          return Result.ok(undefined);
        });

      const result = await useCase.execute(command({}, actorId));

      const offer = offers.get(result.value.offerId);
      expect(offer?.ownerId).toBe(actorId);
      expect(offer?.titleType).toBe(ETitleType.LCI);
      expect(offer?.name).toBe('LCI prefixada');
      expect(offer?.issuerName).toBeNull();
      expect(offer?.revision).toBe(1);
      expect(savedEvents).toEqual(['OfferCreated']);
    },
  );

  it('saves nothing for a blank name', async () => {
    const { useCase, offerRepository } = setup();

    const result = await useCase.execute(command({ name: ' ' }));

    expect(result.error.code).toBe(EAppErrorCode.INVALID_OFFER);
    expect(offerRepository.save).not.toHaveBeenCalled();
  });
});
