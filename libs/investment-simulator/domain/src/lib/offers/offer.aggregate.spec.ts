import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import { ETitleType } from './title-type.enum';
import { Offer } from './offer.aggregate';

const MATURITY = CalendarDate.of('2030-01-02');
const NEW_MATURITY = CalendarDate.of('2031-02-03');
const DELETED_AT = UtcInstant.ofIso('2026-09-27T12:00:00Z');

function createOffer() {
  return Offer.create({
    titleType: ETitleType.CDB,
    issuerName: 'Banco Local',
    maturityDate: MATURITY,
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
  });
}

describe('Offer', () => {
  it('assigns a new identity to each offer', () => {
    expect(createOffer().id).not.toBe(createOffer().id);
  });

  it.each(Object.values(ETitleType))('creates title type %s', (titleType) => {
    const offer = Offer.create({
      titleType,
      issuerName: 'Banco Local',
      maturityDate: MATURITY,
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('105'),
      ),
    });

    expect(offer.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(offer.titleType).toBe(titleType);
    expect(offer.deletedAt).toBeNull();
    expect(offer.getDomainEvents()).toEqual([]);
  });

  it.each<RemunerationTerms>([
    RemunerationTerms.create('PREFIXED', Rate.of('12')),
    RemunerationTerms.create('CDI_PERCENTAGE', Rate.of('105')),
    RemunerationTerms.create('SELIC_PERCENTAGE', Rate.of('90')),
    RemunerationTerms.create('IPCA_PLUS', Rate.of('7.5')),
  ])('creates remuneration $kind', (remunerationTerms) => {
    const offer = Offer.create({
      titleType: ETitleType.LCI,
      issuerName: 'Banco Local',
      maturityDate: MATURITY,
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms,
    });

    expect(offer.remunerationTerms).toEqual(remunerationTerms);
  });

  it('reconstitutes deleted state', () => {
    const offer = Offer.reconstitute({
      id: 'offer-id',
      titleType: ETitleType.LCA,
      issuerName: 'Banco Local',
      maturityDate: MATURITY,
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create('IPCA_PLUS', Rate.of('6')),
      deletedAt: DELETED_AT,
    });

    expect(offer.id).toBe('offer-id');
    expect(offer.deletedAt).toBe(DELETED_AT);
  });

  it('updates each mutable condition independently', () => {
    const offer = createOffer();
    const remuneration = RemunerationTerms.create(
      'SELIC_PERCENTAGE',
      Rate.of('95'),
    );

    expect(offer.updateMaturityDate(NEW_MATURITY)).toBe(offer);
    expect(offer.updateRedemptionTerms(RedemptionTerms.create('DAILY'))).toBe(
      offer,
    );
    expect(offer.updateRemunerationTerms(remuneration)).toBe(offer);

    expect(offer.maturityDate).toBe(NEW_MATURITY);
    expect(offer.redemptionTerms).toEqual(RedemptionTerms.create('DAILY'));
    expect(offer.remunerationTerms).toEqual(remuneration);
    expect(offer.titleType).toBe(ETitleType.CDB);
    expect(offer.issuerName).toBe('Banco Local');
  });

  it('accepts identical updates as successful no-ops', () => {
    const offer = createOffer();
    const redemption = offer.redemptionTerms;
    const remuneration = offer.remunerationTerms;

    expect(offer.updateMaturityDate(MATURITY)).toBe(offer);
    expect(
      offer.updateRedemptionTerms(RedemptionTerms.create('AT_MATURITY')),
    ).toBe(offer);
    expect(
      offer.updateRemunerationTerms(
        RemunerationTerms.create('PREFIXED', Rate.of('12.0')),
      ),
    ).toBe(offer);
    expect(offer.redemptionTerms).toBe(redemption);
    expect(offer.remunerationTerms).toBe(remuneration);
  });

  it('stores immutable terms directly', () => {
    const redemption = RedemptionTerms.create('DAILY');
    const remuneration = RemunerationTerms.create(
      'CDI_PERCENTAGE',
      Rate.of('105'),
    );
    const offer = Offer.create({
      titleType: ETitleType.CDB,
      issuerName: 'Banco Local',
      maturityDate: MATURITY,
      redemptionTerms: redemption,
      remunerationTerms: remuneration,
    });

    expect(offer.redemptionTerms).toBe(redemption);
    expect(offer.remunerationTerms).toBe(remuneration);
  });

  it('soft deletes idempotently and preserves the first instant', () => {
    const offer = createOffer();
    const later = UtcInstant.ofIso('2026-09-28T12:00:00Z');

    expect(offer.delete(DELETED_AT)).toBe(offer);
    offer.delete(later);

    expect(offer.deletedAt).toBe(DELETED_AT);
  });

  it('allows in-memory updates after deletion without restoring the offer', () => {
    const offer = createOffer().delete(DELETED_AT);
    const updatedOffers = [
      offer.updateMaturityDate(NEW_MATURITY),
      offer.updateRedemptionTerms(RedemptionTerms.create('DAILY')),
      offer.updateRemunerationTerms(
        RemunerationTerms.create('IPCA_PLUS', Rate.of('7')),
      ),
    ];

    for (const updatedOffer of updatedOffers) {
      expect(updatedOffer).toBe(offer);
    }
    expect(offer.maturityDate).toBe(NEW_MATURITY);
    expect(offer.redemptionTerms).toEqual(RedemptionTerms.create('DAILY'));
    expect(offer.remunerationTerms).toEqual(
      RemunerationTerms.create('IPCA_PLUS', Rate.of('7')),
    );
    expect(offer.deletedAt).toBe(DELETED_AT);
  });
});
