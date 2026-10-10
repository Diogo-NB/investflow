import {
  BrazilianBusinessDayCalendar,
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
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { TitleType } from '../offers/title-type.enum';
import { Application } from '../applications/application.aggregate';
import { CdiPercentageRemunerationStrategy } from './cdi-percentage-remuneration.strategy';
import { InvestmentCalculationError } from './investment-calculation.error';
import { InvestmentCalculator } from './investment-calculator.domain-service';
import { PrefixedRemunerationStrategy } from './prefixed-remuneration.strategy';
import { SelicPercentageRemunerationStrategy } from './selic-percentage-remuneration.strategy';

const calendar = new BrazilianBusinessDayCalendar();
const calculator = new InvestmentCalculator(calendar, [
  new PrefixedRemunerationStrategy(),
  new CdiPercentageRemunerationStrategy(),
  new SelicPercentageRemunerationStrategy(),
]);
const deletedAt = UtcInstant.ofIso('2026-10-06T12:00:00Z');

function hypothesis(
  options: {
    kind?: RemunerationKind;
    rate?: string;
    start?: string;
    end?: string;
    titleType?: TitleType;
    principal?: string;
  } = {},
) {
  const catalog = Offer.create({
    titleType: options.titleType ?? TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: CalendarDate.of(options.end ?? '2026-01-06'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create(
      options.kind ?? 'PREFIXED',
      Rate.of(options.rate ?? '0.12'),
    ),
  });
  const offerSnapshot = catalog.createSnapshot().value;
  const application = Application.create({
    ownerId: 'owner-id',
    principal: Money.of(options.principal ?? '1000'),
    investmentDate: CalendarDate.of(options.start ?? '2026-01-02'),
    offerSnapshot,
  }).value;
  return { application, offerSnapshot };
}

function curve(
  index: EconomicIndex,
  intervals: readonly [string, string, string][] = [
    ['2026-01-02', '2026-01-05', '0.12'],
  ],
) {
  return IndexCurve.create({
    name: 'Scenario',
    index,
    intervals: intervals.map(([start, end, rate]) =>
      IndexCurveInterval.create(
        CalendarDateRange.of(CalendarDate.of(start), CalendarDate.of(end)),
        IndexValue.of(rate),
      ),
    ),
  }).value;
}

describe('InvestmentCalculator domain service', () => {
  it('returns gross daily balances and a separate maturity tax summary', () => {
    const input = hypothesis();
    const result = calculator.calculate(input).value;
    expect(result.dailyBalances.map((row) => row.date.toIsoString())).toEqual([
      '2026-01-05',
      '2026-01-06',
    ]);
    const expected = 1000 * Math.pow(1.12, 2 / 252);
    expect(result.maturitySummary.grossBalance.amount.toNumber()).toBeCloseTo(
      expected,
      10,
    );
    expect(
      result.maturitySummary.principal.equals(input.application.principal),
    ).toBe(true);
    expect(
      result.maturitySummary.grossBalance.equals(
        result.dailyBalances[1].grossBalance,
      ),
    ).toBe(true);
    let previous = input.application.principal;
    for (const row of result.dailyBalances) {
      expect(
        row.dailyGrossEarnings.equals(row.grossBalance.subtract(previous)),
      ).toBe(true);
      expect(
        row.accumulatedGrossEarnings.equals(
          row.grossBalance.subtract(input.application.principal),
        ),
      ).toBe(true);
      previous = row.grossBalance;
    }
    // Four calendar days, despite only two accrual periods.
    expect(
      result.maturitySummary.iof.amount.equals(
        result.maturitySummary.grossEarnings.amount.times('0.86'),
      ),
    ).toBe(true);
    expect(
      result.maturitySummary.incomeTax.amount.equals(
        result.maturitySummary.grossEarnings.amount
          .minus(result.maturitySummary.iof.amount)
          .times('0.225'),
      ),
    ).toBe(true);
    expect(
      result.maturitySummary.netBalance.equals(
        result.maturitySummary.grossBalance.subtract(
          result.maturitySummary.totalTaxes,
        ),
      ),
    ).toBe(true);
    expect(
      result.maturitySummary.grossBalance.amount.decimalPlaces(),
    ).toBeGreaterThan(2);
    expect(input.application.deletedAt).toBeNull();
    expect(input.application.offerSnapshotId).toBe(input.offerSnapshot.id);
    expect(input.offerSnapshot.remunerationTerms.rate.value.toString()).toBe(
      '0.12',
    );
    expect(input.application.getDomainEvents()).toEqual([]);
    expect(input.offerSnapshot.getDomainEvents()).toEqual([]);
  });

  it('compounds a fixed annual rate over 252 business days', () => {
    const start = CalendarDate.of('2026-01-02');
    let maturity = start;
    let count = 0;
    while (count < 252) {
      maturity = maturity.addDays(1);
      if (calendar.isBusinessDay(maturity)) count++;
    }
    const result = calculator.calculate(
      hypothesis({ end: maturity.toIsoString() }),
    ).value;
    expect(result.dailyBalances).toHaveLength(252);
    expect(
      result.maturitySummary.grossBalance.amount
        .minus(1120)
        .abs()
        .lessThan('0.000000000001'),
    ).toBe(true);
  });

  it('skips Good Friday and the weekend without adding accrual periods', () => {
    const input = hypothesis({
      kind: 'CDI_PERCENTAGE',
      rate: '1',
      start: '2026-04-02',
      end: '2026-04-06',
    });
    const indexCurve = curve(EconomicIndex.CDI, [
      ['2026-04-02', '2026-04-02', '0.12'],
    ]);
    const result = calculator.calculate({ ...input, indexCurve }).value;
    expect(result.dailyBalances).toHaveLength(1);
    expect(result.dailyBalances[0].date.toIsoString()).toBe('2026-04-06');
    expect(result.maturitySummary.grossBalance.amount.toNumber()).toBeCloseTo(
      1000 * Math.pow(1.12, 1 / 252),
      10,
    );
    expect(indexCurve.intervals).toHaveLength(1);
    expect(indexCurve.deletedAt).toBeNull();
  });

  describe.each([
    ['CDI_PERCENTAGE', EconomicIndex.CDI],
    ['SELIC_PERCENTAGE', EconomicIndex.SELIC],
  ] as const)('%s', (kind, index) => {
    it.each(['0.5', '1', '1.05', '2'])(
      'applies %s of the daily index rate',
      (rate) => {
        const result = calculator.calculate({
          ...hypothesis({ kind, rate }),
          indexCurve: curve(index),
        }).value;
        const expectedFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * Number(rate);
        expect(
          result.maturitySummary.grossBalance.amount.toNumber(),
        ).toBeCloseTo(1000 * expectedFactor * expectedFactor, 10);
      },
    );

    it('uses start-date rates, excludes maturity, and needs no weekend values', () => {
      const input = hypothesis({ kind, rate: '1.05' });
      const indexCurve = curve(index, [
        ['2026-01-02', '2026-01-02', '0.12'],
        ['2026-01-05', '2026-01-05', '0.20'],
      ]);
      const result = calculator.calculate({ ...input, indexCurve }).value;
      const fridayFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * 1.05;
      const mondayFactor = 1 + (Math.pow(1.2, 1 / 252) - 1) * 1.05;
      expect(
        result.dailyBalances[0].grossBalance.amount.toNumber(),
      ).toBeCloseTo(1000 * fridayFactor, 10);
      expect(
        result.dailyBalances[1].grossBalance.amount.toNumber(),
      ).toBeCloseTo(1000 * fridayFactor * mondayFactor, 10);
      expect(calculator.calculate({ ...input, indexCurve }).value).toEqual(
        result,
      );
    });

    it('allows an explicit zero index rate', () => {
      const result = calculator.calculate({
        ...hypothesis({ kind, rate: '1' }),
        indexCurve: curve(index, [['2026-01-02', '2026-01-05', '0']]),
      }).value;
      expect(result.maturitySummary.grossBalance.amount.toString()).toBe(
        '1000',
      );
      expect(result.maturitySummary.totalTaxes.isZero()).toBe(true);
      expect(
        result.dailyBalances.every((row) => row.dailyGrossEarnings.isZero()),
      ).toBe(true);
    });

    it('requires a curve and rejects deleted curves', () => {
      const input = hypothesis({ kind, rate: '1' });
      expect(calculator.calculate(input).error.code).toBe(
        'INVESTMENT_CURVE_REQUIRED',
      );
      expect(
        calculator.calculate({
          ...input,
          indexCurve: curve(index).delete(deletedAt),
        }).error.code,
      ).toBe('INVESTMENT_CURVE_UNAVAILABLE');
    });

    it('rejects substitution with another index, including IPCA', () => {
      const input = hypothesis({ kind, rate: '1' });
      const otherIndex =
        index === EconomicIndex.CDI ? EconomicIndex.SELIC : EconomicIndex.CDI;
      expect(
        calculator.calculate({ ...input, indexCurve: curve(otherIndex) }).error
          .code,
      ).toBe('INVESTMENT_CURVE_INCOMPATIBLE');
      const ipca = curve(EconomicIndex.IPCA, [
        ['2026-01-01', '2026-01-31', '0.01'],
      ]);
      expect(
        calculator.calculate({ ...input, indexCurve: ipca }).error.code,
      ).toBe('INVESTMENT_CURVE_INCOMPATIBLE');
    });

    it('reports every missing required reference without a partial result', () => {
      const result = calculator.calculate({
        ...hypothesis({ kind, rate: '1' }),
        indexCurve: curve(index, [['2026-01-06', '2026-01-06', '0.12']]),
      });
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvestmentCalculationError);
      expect(result.error.code).toBe('INVESTMENT_CURVE_COVERAGE_MISSING');
      expect(result.error.metadata?.['missingReferences']).toEqual([
        '2026-01-02',
        '2026-01-05',
      ]);
    });

    it('requires the last interval start even when the investment date is covered', () => {
      const result = calculator.calculate({
        ...hypothesis({ kind, rate: '1' }),
        indexCurve: curve(index, [['2026-01-02', '2026-01-02', '0.12']]),
      });
      expect(result.error.metadata?.['missingReferences']).toEqual([
        '2026-01-05',
      ]);
    });
  });

  it.each([
    { start: '2026-01-03', end: '2026-01-06' },
    { start: '2026-01-02', end: '2026-01-04' },
    { start: '2026-04-03', end: '2026-04-06' },
    { start: '2026-04-02', end: '2026-04-03' },
  ])('rejects non-business investment or maturity dates: %j', (options) => {
    const input = hypothesis(options);
    const result = calculator.calculate(input);
    expect(result.error.code).toBe('INVESTMENT_DATE_NOT_BUSINESS_DAY');
    expect(input.application.investmentDate.toIsoString()).toBe(options.start);
    expect(input.offerSnapshot.maturityDate.toIsoString()).toBe(options.end);
  });

  it('rejects deleted applications and mismatched or catalog offers', () => {
    const input = hypothesis();
    expect(
      calculator.calculate({
        ...input,
        offerSnapshot: hypothesis().offerSnapshot,
      }).error.code,
    ).toBe('INVESTMENT_OFFER_SNAPSHOT_MISMATCH');
    const catalog = Offer.create({
      titleType: TitleType.CDB,
      issuerId: 'issuer',
      maturityDate: input.offerSnapshot.maturityDate,
      redemptionTerms: input.offerSnapshot.redemptionTerms,
      remunerationTerms: input.offerSnapshot.remunerationTerms,
    });
    expect(
      calculator.calculate({ ...input, offerSnapshot: catalog }).error.code,
    ).toBe('INVESTMENT_OFFER_SNAPSHOT_MISMATCH');
    input.application.delete(deletedAt);
    expect(calculator.calculate(input).error.code).toBe(
      'INVESTMENT_APPLICATION_UNAVAILABLE',
    );
  });

  it('rejects a reconstituted unavailable snapshot', () => {
    const input = hypothesis();
    const offerSnapshot = Offer.reconstitute({
      id: input.offerSnapshot.id,
      sourceOfferId: 'catalog',
      titleType: TitleType.CDB,
      issuerId: 'issuer',
      maturityDate: input.offerSnapshot.maturityDate,
      redemptionTerms: input.offerSnapshot.redemptionTerms,
      remunerationTerms: input.offerSnapshot.remunerationTerms,
      deletedAt,
    });
    expect(calculator.calculate({ ...input, offerSnapshot }).error.code).toBe(
      'INVESTMENT_OFFER_UNAVAILABLE',
    );
  });

  it.each([TitleType.LCI, TitleType.LCA])(
    'rejects unsupported title %s',
    (titleType) => {
      expect(calculator.calculate(hypothesis({ titleType })).error.code).toBe(
        'INVESTMENT_TITLE_UNSUPPORTED',
      );
    },
  );

  it('returns an explicit error for deferred IPCA', () => {
    expect(
      calculator.calculate(hypothesis({ kind: 'IPCA_PLUS' })).error.code,
    ).toBe('INVESTMENT_REMUNERATION_UNSUPPORTED');
  });

  it('rejects an invalid reconstituted investment period', () => {
    const input = hypothesis();
    const application = Application.reconstitute({
      id: input.application.id,
      ownerId: 'owner',
      offerSnapshotId: input.offerSnapshot.id,
      principal: input.application.principal,
      investmentDate: input.offerSnapshot.maturityDate,
      deletedAt: null,
    });
    expect(calculator.calculate({ ...input, application }).error.code).toBe(
      'INVESTMENT_PERIOD_INVALID',
    );
  });

  it('preserves fractional principal precision', () => {
    const input = hypothesis({
      kind: 'SELIC_PERCENTAGE',
      rate: '1',
      principal: '1000.123456789123456',
    });
    const result = calculator.calculate({
      ...input,
      indexCurve: curve(EconomicIndex.SELIC, [
        ['2026-01-02', '2026-01-05', '0'],
      ]),
    }).value;
    expect(result.maturitySummary.netBalance.amount.toString()).toBe(
      '1000.123456789123456',
    );
  });

  it('returns a typed failure for numerical overflow', () => {
    const result = calculator.calculate(
      hypothesis({ rate: '1e1000', principal: '1e9000000000000000' }),
    );
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('INVESTMENT_CALCULATION_FAILED');
    expect(result.error.kind).toBe('unexpected');
  });
});
