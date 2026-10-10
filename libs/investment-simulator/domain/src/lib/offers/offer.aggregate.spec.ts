import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import { TitleType } from './title-type.enum';
import { Offer } from './offer.aggregate';
import {
  ImmutableOfferSnapshotError,
  InvalidOfferSnapshotError,
} from './offer.error';

const MATURITY = CalendarDate.of('2030-01-02');
const NEW_MATURITY = CalendarDate.of('2031-02-03');
const DELETED_AT = UtcInstant.ofIso('2026-09-27T12:00:00Z');

function createOffer() {
  return Offer.create({
    titleType: TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: MATURITY,
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
  });
}

describe('Offer', () => {
  it('creates catalog offers without snapshot provenance', () => {
    const offer = createOffer();
    expect(offer.sourceOfferId).toBeNull();
    expect(offer.isSnapshot).toBe(false);
  });

  it('captures conditions in independently identified snapshots', () => {
    const offer = createOffer();
    const snapshot = offer.createSnapshot().value;
    const another = offer.createSnapshot().value;

    expect(new Set([offer.id, snapshot.id, another.id]).size).toBe(3);
    expect(snapshot.sourceOfferId).toBe(offer.id);
    expect(snapshot.isSnapshot).toBe(true);
    expect(snapshot.titleType).toBe(offer.titleType);
    expect(snapshot.issuerId).toBe(offer.issuerId);
    expect(snapshot.maturityDate).toBe(offer.maturityDate);
    expect(snapshot.redemptionTerms).toBe(offer.redemptionTerms);
    expect(snapshot.remunerationTerms).toBe(offer.remunerationTerms);
    expect(snapshot.deletedAt).toBeNull();

    offer.updateMaturityDate(NEW_MATURITY);
    offer.updateRedemptionTerms(RedemptionTerms.create('DAILY'));
    offer.updateRemunerationTerms(
      RemunerationTerms.create('CDI_PERCENTAGE', Rate.of('1.1')),
    );
    offer.delete(DELETED_AT);

    expect(snapshot.maturityDate).toBe(MATURITY);
    expect(snapshot.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(snapshot.remunerationTerms.kind).toBe('PREFIXED');
    expect(snapshot.remunerationTerms.contractRate.equals(Rate.of('12'))).toBe(
      true,
    );
    expect(snapshot.deletedAt).toBeNull();
    expect(snapshot.createSnapshot().isOk()).toBe(true);
  });

  it('creates replacement snapshots while preserving original provenance', () => {
    const offer = createOffer();
    const snapshot = offer.createSnapshot().value;
    const remunerationTerms = RemunerationTerms.create(
      'CDI_PERCENTAGE',
      Rate.of('1.1'),
    );
    const redemptionTerms = RedemptionTerms.create('DAILY');
    const replacement = snapshot.createSnapshot({
      maturityDate: NEW_MATURITY,
      remunerationTerms,
      redemptionTerms,
    }).value;

    expect(replacement.id).not.toBe(snapshot.id);
    expect(replacement.sourceOfferId).toBe(offer.id);
    expect(replacement.titleType).toBe(snapshot.titleType);
    expect(replacement.issuerId).toBe(snapshot.issuerId);
    expect(replacement.maturityDate).toBe(NEW_MATURITY);
    expect(replacement.remunerationTerms).toBe(remunerationTerms);
    expect(replacement.redemptionTerms).toBe(redemptionTerms);
    expect(snapshot.maturityDate).toBe(MATURITY);
    expect(snapshot.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(snapshot.remunerationTerms.kind).toBe('PREFIXED');
  });

  it('applies partial overrides when capturing a catalog offer', () => {
    const offer = createOffer();
    const snapshot = offer.createSnapshot({
      maturityDate: NEW_MATURITY,
    }).value;
    expect(snapshot.maturityDate).toBe(NEW_MATURITY);
    expect(snapshot.redemptionTerms).toBe(offer.redemptionTerms);
    expect(snapshot.remunerationTerms).toBe(offer.remunerationTerms);
    expect(offer.maturityDate).toBe(MATURITY);
  });

  it('rejects snapshot creation from a deleted catalog offer', () => {
    const offer = createOffer().delete(DELETED_AT);
    const result = offer.createSnapshot();
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidOfferSnapshotError);
  });

  it('reconstitutes snapshot identity and provenance', () => {
    const original = createOffer().createSnapshot().value;
    const snapshot = Offer.reconstitute({
      id: original.id,
      sourceOfferId: original.sourceOfferId,
      titleType: original.titleType,
      issuerId: original.issuerId,
      maturityDate: original.maturityDate,
      redemptionTerms: original.redemptionTerms,
      remunerationTerms: original.remunerationTerms,
      deletedAt: null,
    });
    expect(snapshot.id).toBe(original.id);
    expect(snapshot.sourceOfferId).toBe(original.sourceOfferId);
    expect(snapshot.isSnapshot).toBe(true);
    expect(() => snapshot.delete(DELETED_AT)).toThrow(
      ImmutableOfferSnapshotError,
    );
  });

  it('rejects every snapshot mutation, including identical updates', () => {
    const snapshot = createOffer().createSnapshot().value;
    const mutations = [
      () => snapshot.updateMaturityDate(NEW_MATURITY),
      () => snapshot.updateMaturityDate(snapshot.maturityDate),
      () => snapshot.updateRedemptionTerms(RedemptionTerms.create('DAILY')),
      () => snapshot.updateRedemptionTerms(snapshot.redemptionTerms),
      () =>
        snapshot.updateRemunerationTerms(
          RemunerationTerms.create('CDI_PERCENTAGE', Rate.of('1.1')),
        ),
      () => snapshot.updateRemunerationTerms(snapshot.remunerationTerms),
      () => snapshot.delete(DELETED_AT),
    ];
    for (const mutate of mutations) {
      expect(mutate).toThrow(ImmutableOfferSnapshotError);
    }
    expect(snapshot.maturityDate).toBe(MATURITY);
    expect(snapshot.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(snapshot.remunerationTerms.kind).toBe('PREFIXED');
    expect(snapshot.deletedAt).toBeNull();
  });

  it('assigns a new identity to each offer', () => {
    expect(createOffer().id).not.toBe(createOffer().id);
  });

  it.each(Object.values(TitleType))('creates title type %s', (titleType) => {
    const offer = Offer.create({
      titleType,
      issuerId: 'issuer-id',
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
      titleType: TitleType.LCI,
      issuerId: 'issuer-id',
      maturityDate: MATURITY,
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms,
    });

    expect(offer.remunerationTerms).toEqual(remunerationTerms);
  });

  it('reconstitutes deleted state', () => {
    const offer = Offer.reconstitute({
      id: 'offer-id',
      titleType: TitleType.LCA,
      issuerId: 'issuer-id',
      maturityDate: MATURITY,
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create('IPCA_PLUS', Rate.of('6')),
      deletedAt: DELETED_AT,
    });

    expect(offer.id).toBe('offer-id');
    expect(offer.deletedAt).toBe(DELETED_AT);
    expect(offer.sourceOfferId).toBeNull();
    expect(offer.isSnapshot).toBe(false);
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
    expect(offer.titleType).toBe(TitleType.CDB);
    expect(offer.issuerId).toBe('issuer-id');
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
      titleType: TitleType.CDB,
      issuerId: 'issuer-id',
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
