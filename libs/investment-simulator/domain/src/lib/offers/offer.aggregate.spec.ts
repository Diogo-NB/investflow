import {
  CalendarDate,
  EAppErrorCode,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { CreateOfferProps, Offer } from './offer.aggregate';
import { InvalidOfferError } from './offer.error';
import { OfferChanged, OfferCreated, OfferDeleted } from './offer.events';
import { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { ETitleType } from './title-type.enum';

const AT = UtcInstant.ofIso('2026-10-04T12:00:00Z');
const LATER = UtcInstant.ofIso('2026-10-05T12:00:00Z');
const MATURITY = CalendarDate.of('2030-01-02');

function props(overrides: Partial<CreateOfferProps> = {}): CreateOfferProps {
  return {
    titleType: ETitleType.CDB,
    ownerId: 'user-1',
    name: ' CDB 110% do CDI ',
    issuerName: ' Banco Local ',
    maturityDate: MATURITY,
    redemptionTerms: RedemptionTerms.create('DAILY'),
    remunerationTerms: RemunerationTerms.create(
      'CDI_PERCENTAGE',
      Rate.of('1.10'),
    ),
    ...overrides,
  };
}

function create(overrides: Partial<CreateOfferProps> = {}) {
  return Offer.create(props(overrides), AT);
}

function restore(offer: Offer): Offer {
  return Offer.reconstitute({
    id: offer.id,
    titleType: offer.titleType,
    ownerId: offer.ownerId,
    name: offer.name,
    issuerName: offer.issuerName,
    maturityDate: offer.maturityDate,
    redemptionTerms: offer.redemptionTerms,
    remunerationTerms: offer.remunerationTerms,
    revision: offer.revision,
    deletedAt: offer.deletedAt,
  });
}

describe('Offer', () => {
  it('creates distinct identities at revision 1, normalizes text and raises a creation event', () => {
    const first = create().value;
    const second = create({ issuerName: '  ' }).value;

    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.name).toBe('CDB 110% do CDI');
    expect(first.issuerName).toBe('Banco Local');
    expect(second.issuerName).toBeNull();
    expect(first.revision).toBe(1);
    expect(first.deletedAt).toBeNull();

    const [event] = first.getDomainEvents();
    expect(event).toBeInstanceOf(OfferCreated);
    // Events are notifications: identifiers only, never the offer's terms.
    expect({ ...event }).toEqual({
      eventId: expect.any(String),
      eventType: 'OfferCreated',
      aggregateType: 'Offer',
      aggregateId: first.id,
      context: 'investment-simulator',
      version: 1,
      occurredAt: AT,
    });
  });

  it('rejects a blank name', () => {
    const result = create({ name: '   ' });

    expect(result.error).toBeInstanceOf(InvalidOfferError);
    expect(result.error.code).toBe(EAppErrorCode.INVALID_OFFER);
  });

  it('reconstitutes persisted state without raising events', () => {
    const original = create().value;
    const offer = restore(original);

    expect(offer.id).toBe(original.id);
    expect(offer.titleType).toBe(ETitleType.CDB);
    expect(offer.remunerationTerms).toEqual(original.remunerationTerms);
    expect(offer.getDomainEvents()).toEqual([]);
  });

  it('decides visibility and ownership, with null as the system', () => {
    const own = create().value;
    const system = create({ ownerId: null }).value;

    expect(own.isVisibleTo('user-1')).toBe(true);
    expect(own.isVisibleTo('user-2')).toBe(false);
    expect(own.isVisibleTo(null)).toBe(false);
    expect(own.canBeChangedBy('user-1')).toBe(true);
    expect(system.isVisibleTo('user-2')).toBe(true);
    expect(system.canBeChangedBy('user-2')).toBe(false);
    expect(system.canBeChangedBy(null)).toBe(true);
  });

  it("duplicates into the actor's private copy with the same terms", () => {
    const source = create({ ownerId: null }).value;
    const copy = source.duplicateFor('user-2', LATER).value;

    expect(copy.id).not.toBe(source.id);
    expect(copy.ownerId).toBe('user-2');
    expect(copy.titleType).toBe(source.titleType);
    expect(copy.name).toBe('CDB 110% do CDI (cópia)');
    expect(copy.issuerName).toBe(source.issuerName);
    expect(copy.maturityDate).toBe(source.maturityDate);
    expect(copy.redemptionTerms).toBe(source.redemptionTerms);
    expect(copy.remunerationTerms).toBe(source.remunerationTerms);
    expect(copy.revision).toBe(1);
    expect(copy.getDomainEvents()).toEqual([expect.any(OfferCreated)]);
  });

  it('accepts the current revision and reports a conflict otherwise', () => {
    const offer = create().value;

    expect(offer.assertRevision(1).isOk()).toBe(true);
    const conflict = offer.assertRevision(2).error;
    expect(conflict.code).toBe(EAppErrorCode.OFFER_REVISION_CONFLICT);
    expect(conflict.kind).toBe('conflict');
  });

  it('edits supplied fields, increments the revision once and raises a change event', () => {
    const offer = restore(create().value);
    const remuneration = RemunerationTerms.create('PREFIXED', Rate.of('0.12'));

    const result = offer.edit(
      {
        name: 'Prefixado',
        issuerName: null,
        maturityDate: CalendarDate.of('2031-02-03'),
        redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
        remunerationTerms: remuneration,
      },
      LATER,
    );

    expect(result.isOk()).toBe(true);
    expect(offer.revision).toBe(2);
    expect(offer.name).toBe('Prefixado');
    expect(offer.issuerName).toBeNull();
    expect(offer.maturityDate.toIsoString()).toBe('2031-02-03');
    expect(offer.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(offer.remunerationTerms).toBe(remuneration);
    const [event] = offer.getDomainEvents();
    expect(event).toBeInstanceOf(OfferChanged);
    expect(event).toMatchObject({ aggregateId: offer.id, occurredAt: LATER });
  });

  it.each([
    {},
    {
      name: ' CDB 110% do CDI ',
      issuerName: 'Banco Local',
      maturityDate: CalendarDate.of('2030-01-02'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('1.100'),
      ),
    },
  ])(
    'keeps the revision and raises nothing for an empty or identical edit',
    (edit) => {
      const offer = restore(create().value);

      expect(offer.edit(edit, LATER).isOk()).toBe(true);
      expect(offer.revision).toBe(1);
      expect(offer.getDomainEvents()).toEqual([]);
    },
  );

  it('rejects an invalid edit without changing anything', () => {
    const offer = restore(create().value);

    const result = offer.edit({ name: ' ' }, LATER);

    expect(result.error).toBeInstanceOf(InvalidOfferError);
    expect(offer.name).toBe('CDB 110% do CDI');
    expect(offer.revision).toBe(1);
    expect(offer.getDomainEvents()).toEqual([]);
  });

  it('gives all changes before a save one revision, and a new one after it', () => {
    const fresh = create().value;
    fresh.edit({ name: 'Renomeada' }, AT);
    expect(fresh.revision).toBe(1);

    const offer = restore(fresh);
    offer.edit({ name: 'CDB curto' }, AT);
    offer.delete(LATER);
    expect(offer.revision).toBe(2);

    offer.markPersisted().edit({ name: 'CDB longo' }, LATER);
    expect(offer.revision).toBe(3);
  });

  it('deletes once, incrementing the revision', () => {
    const offer = restore(create().value);

    expect(offer.delete(AT)).toBe(offer);
    offer.delete(LATER);

    expect(offer.deletedAt).toBe(AT);
    expect(offer.revision).toBe(2);
    const events = offer.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OfferDeleted);
    expect(events[0]).toMatchObject({ aggregateId: offer.id, occurredAt: AT });
  });
});
