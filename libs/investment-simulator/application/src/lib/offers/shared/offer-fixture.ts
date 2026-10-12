// An in-memory repository shared by the offer use-case specs.
import {
  ETitleType,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
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

export const USER = 'user-1';
export const OTHER_USER = 'user-2';
export const NOW = UtcInstant.ofIso('2026-10-11T12:00:00Z');

// Specs pass jest.fn, which the library build cannot reference.
type Spy = <F extends (...args: never[]) => unknown>(implementation: F) => F;

export function offerFixture(spy: Spy) {
  const offers = new Map<string, Offer>();

  const offerRepository = {
    findById: spy(async (id: string) => {
      const offer = offers.get(id);
      return offer && !offer.deletedAt
        ? Result.ok(offer)
        : Result.err(new OfferNotFoundError(id));
    }),
    save: spy(async (offer: Offer) => {
      offers.set(offer.id, offer);
      offer.markPersisted();
      return Result.ok(undefined);
    }),
  } satisfies OfferRepository;

  const clock = { now: () => NOW } as unknown as Clock;

  // Stores an offer without recording the save.
  function given(ownerId: string | null): Offer {
    const offer = Offer.create(
      {
        ownerId,
        titleType: ETitleType.CDB,
        name: 'CDB 110% do CDI',
        issuerName: 'Banco Local',
        maturityDate: CalendarDate.of('2028-12-29'),
        redemptionTerms: RedemptionTerms.create('DAILY'),
        remunerationTerms: RemunerationTerms.create(
          'CDI_PERCENTAGE',
          Rate.of('1.10'),
        ),
      },
      NOW,
    ).value.markPersisted();
    offers.set(offer.id, offer);
    return offer;
  }

  return { offers, offerRepository, clock, given };
}
