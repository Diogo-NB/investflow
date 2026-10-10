import {
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { EconomicIndex } from '../index-curves/economic-index.enum';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { IndexCurveInterval } from '../index-curves/index-curve-interval.vo';
import { IndexValue } from '../index-curves/index-value.vo';
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

function cdiSnapshot(): Offer {
  return createOffer().createSnapshot({
    remunerationTerms: RemunerationTerms.create(
      'CDI_PERCENTAGE',
      Rate.of('1.05'),
    ),
  }).value;
}

function cdiCurve(index = EconomicIndex.CDI): IndexCurve {
  return IndexCurve.create({
    name: 'Base',
    index,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(INVESTMENT_DATE, MATURITY),
        IndexValue.of('0.12'),
      ),
    ],
  }).value;
}

function createInput(): CreateApplicationProps {
  return {
    ownerId: 'owner-id',
    offerSnapshot: createOffer().createSnapshot().value,
    indexCurve: null,
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
    expect(application.indexCurveId).toBeNull();
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
    ['curve for a fixed rate', () => ({ indexCurve: cdiCurve() })],
    ['missing indexed curve', () => ({ offerSnapshot: cdiSnapshot() })],
    [
      'curve of another index',
      () => ({
        offerSnapshot: cdiSnapshot(),
        indexCurve: cdiCurve(EconomicIndex.SELIC),
      }),
    ],
    [
      'deleted curve',
      () => ({
        offerSnapshot: cdiSnapshot(),
        indexCurve: cdiCurve().delete(DELETED_AT),
      }),
    ],
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
      indexCurve: null,
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
        indexCurve: null,
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
        indexCurveId: null,
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
      indexCurve: null,
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

  it('links the curve of an indexed remuneration', () => {
    const indexCurve = cdiCurve();
    const application = Application.create({
      ...createInput(),
      offerSnapshot: cdiSnapshot(),
      indexCurve,
    }).value;
    expect(application.indexCurveId).toBe(indexCurve.id);

    const revision = application.revise({ ...createInput() });
    expect(revision.isOk()).toBe(true);
    expect(application.indexCurveId).toBeNull();
  });

  it('reports the scenario rule a rejected investment breaks', () => {
    const error = Application.create({
      ...createInput(),
      offerSnapshot: cdiSnapshot(),
    }).error;
    expect(error.code).toBe('INVALID_APPLICATION');
    expect(error.metadata?.['scenarioCode']).toBe('INVESTMENT_CURVE_REQUIRED');
  });

  describe('toScenario', () => {
    function linked() {
      const input = {
        ...createInput(),
        offerSnapshot: cdiSnapshot(),
        indexCurve: cdiCurve(),
      };
      return { input, application: Application.create(input).value };
    }

    it('builds the scenario from its own snapshot and curve', () => {
      const { input, application } = linked();
      const scenario = application.toScenario(
        input.offerSnapshot,
        input.indexCurve,
      ).value;
      expect(scenario.principal).toBe(input.principal);
      expect(scenario.investmentDate).toBe(input.investmentDate);
      expect(scenario.maturityDate).toBe(input.offerSnapshot.maturityDate);
      expect(scenario.titleType).toBe(TitleType.CDB);
      expect(scenario.remuneration).toBe(input.offerSnapshot.remunerationTerms);
      expect(scenario.indexCurve).toBe(input.indexCurve);
    });

    it('rejects references the application does not hold', () => {
      const { input, application } = linked();
      expect(
        application.toScenario(cdiSnapshot(), input.indexCurve).error,
      ).toBeInstanceOf(InvalidApplicationError);
      expect(
        application.toScenario(input.offerSnapshot, cdiCurve()).error,
      ).toBeInstanceOf(InvalidApplicationError);
      expect(
        application.toScenario(input.offerSnapshot, null).error,
      ).toBeInstanceOf(InvalidApplicationError);
    });

    it('rejects deleted applications and curves deleted after linking', () => {
      const { input, application } = linked();
      input.indexCurve.delete(DELETED_AT);
      expect(
        application.toScenario(input.offerSnapshot, input.indexCurve).error
          .code,
      ).toBe('INVESTMENT_CURVE_UNAVAILABLE');
      application.delete(DELETED_AT);
      expect(
        application.toScenario(input.offerSnapshot, input.indexCurve).error,
      ).toBeInstanceOf(ApplicationDeletedError);
    });
  });
});
