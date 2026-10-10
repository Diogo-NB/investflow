import {
  CalendarDate,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Offer } from '../offers/offer.aggregate';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import { RemunerationTerms } from '../offers/terms/remuneration/remuneration-terms.vo';
import { TitleType } from '../offers/title-type.enum';
import {
  Application,
  CreateApplicationProps,
  ReviseApplicationProps,
} from './application.aggregate';
import {
  ApplicationDeletedError,
  InvalidApplicationError,
} from './application.error';

const MATURITY = CalendarDate.of('2030-01-02');
const INVESTMENT_DATE = CalendarDate.of('2026-01-02');
const DELETED_AT = UtcInstant.ofIso('2026-10-06T12:00:00Z');

function createOffer(): Offer {
  return Offer.create({
    titleType: TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: MATURITY,
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
  });
}

function createInput(): CreateApplicationProps {
  return {
    ownerId: 'owner-id',
    offerSnapshot: createOffer().createSnapshot().value,
    principal: Money.of('1000.123456789'),
    investmentDate: INVESTMENT_DATE,
  };
}

describe('Application', () => {
  it('creates independently identified hypotheses referencing a snapshot', () => {
    const input = createInput();
    const application = Application.create(input).value;
    const another = Application.create(input).value;

    expect(application.id).not.toBe(another.id);
    expect(application.ownerId).toBe(input.ownerId);
    expect(application.offerSnapshotId).toBe(input.offerSnapshot.id);
    expect(application.principal).toBe(input.principal);
    expect(application.investmentDate).toBe(input.investmentDate);
    expect(application.deletedAt).toBeNull();
    expect(application.getDomainEvents()).toEqual([]);
  });

  const invalidInputs: [string, () => Partial<ReviseApplicationProps>][] = [
    ['catalog offer', () => ({ offerSnapshot: createOffer() })],
    ['zero principal', () => ({ principal: Money.zero() })],
    ['negative principal', () => ({ principal: Money.of('-1') })],
    ['foreign currency', () => ({ principal: Money.of('1000', 'USD') })],
    ['date on maturity', () => ({ investmentDate: MATURITY })],
    ['date after maturity', () => ({ investmentDate: MATURITY.addDays(1) })],
  ];

  it.each(invalidInputs)(
    'rejects creation with %s',
    (_reason, invalidInput) => {
      const result = Application.create({
        ...createInput(),
        ...invalidInput(),
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidApplicationError);
    },
  );

  it.each(['2000-01-01', '2026-10-10', '2026-12-25'])(
    'accepts past dates, weekends, and holidays: %s',
    (date) => {
      const result = Application.create({
        ...createInput(),
        investmentDate: CalendarDate.of(date),
      });
      expect(result.isOk()).toBe(true);
      expect(result.value.investmentDate.toIsoString()).toBe(date);
    },
  );

  it('revises all investment inputs together without changing identity or ownership', () => {
    const input = createInput();
    const application = Application.create(input).value;
    const id = application.id;
    const snapshot = input.offerSnapshot.createSnapshot({
      maturityDate: CalendarDate.of('2032-01-02'),
      remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.15')),
    }).value;
    const principal = Money.of('2500');
    const investmentDate = CalendarDate.of('2031-01-02');

    const result = application.revise({
      offerSnapshot: snapshot,
      principal,
      investmentDate,
    });

    expect(result.isOk()).toBe(true);
    expect(application.id).toBe(id);
    expect(application.ownerId).toBe(input.ownerId);
    expect(application.offerSnapshotId).toBe(snapshot.id);
    expect(application.principal).toBe(principal);
    expect(application.investmentDate).toBe(investmentDate);
    expect(input.offerSnapshot.maturityDate).toBe(MATURITY);
  });

  it.each(invalidInputs)(
    'preserves the entire investment state when revision fails with %s',
    (_reason, invalidInput) => {
      const input = createInput();
      const application = Application.create(input).value;
      const result = application.revise({
        offerSnapshot: input.offerSnapshot.createSnapshot().value,
        principal: Money.of('5000'),
        investmentDate: INVESTMENT_DATE.addDays(1),
        ...invalidInput(),
      });

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidApplicationError);
      expect(application.offerSnapshotId).toBe(input.offerSnapshot.id);
      expect(application.principal).toBe(input.principal);
      expect(application.investmentDate).toBe(input.investmentDate);
    },
  );

  it('accepts an identical revision', () => {
    const input = createInput();
    const application = Application.create(input).value;
    expect(application.revise(input).isOk()).toBe(true);
  });

  it.each([null, DELETED_AT])(
    'reconstitutes the stored state with deletedAt %s without loading an offer',
    (deletedAt) => {
      const input = createInput();
      const application = Application.reconstitute({
        id: 'application-id',
        ownerId: input.ownerId,
        offerSnapshotId: input.offerSnapshot.id,
        principal: input.principal,
        investmentDate: input.investmentDate,
        deletedAt,
      });
      expect(application.id).toBe('application-id');
      expect(application.ownerId).toBe(input.ownerId);
      expect(application.offerSnapshotId).toBe(input.offerSnapshot.id);
      expect(application.principal).toBe(input.principal);
      expect(application.investmentDate).toBe(input.investmentDate);
      expect(application.deletedAt).toBe(deletedAt);
      if (deletedAt) {
        expect(application.revise(input).error).toBeInstanceOf(
          ApplicationDeletedError,
        );
      }
    },
  );

  it('preserves the first deletion instant and rejects subsequent revisions', () => {
    const input = createInput();
    const application = Application.create(input).value;
    expect(application.delete(DELETED_AT)).toBe(application);
    application.delete(UtcInstant.ofIso('2026-10-07T12:00:00Z'));

    const result = application.revise({
      offerSnapshot: input.offerSnapshot.createSnapshot().value,
      principal: Money.of('5000'),
      investmentDate: INVESTMENT_DATE.addDays(1),
    });
    expect(application.deletedAt).toBe(DELETED_AT);
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(ApplicationDeletedError);
    expect(application.offerSnapshotId).toBe(input.offerSnapshot.id);
    expect(application.principal).toBe(input.principal);
    expect(application.investmentDate).toBe(input.investmentDate);
  });
});
