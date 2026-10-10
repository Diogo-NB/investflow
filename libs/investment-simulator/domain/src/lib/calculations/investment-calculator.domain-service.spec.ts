import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
} from '@investflow/shared-domain';
import { EconomicIndex } from '../index-curves/economic-index.enum';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { IndexCurveInterval } from '../index-curves/index-curve-interval.vo';
import { IndexValue } from '../index-curves/index-value.vo';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { TitleType } from '../offers/title-type.enum';
import { InvestmentCalculationError } from './investment-calculation.error';
import {
  InvestmentCalculator,
  METHODOLOGY_VERSION,
} from './investment-calculator.domain-service';
import { InvestmentScenario } from './investment-scenario.vo';

const calendar = new BrazilianBusinessDayCalendar();
const calculator = new InvestmentCalculator(calendar);

function scenario(
  options: {
    kind?: RemunerationKind;
    rate?: string;
    start?: string;
    end?: string;
    titleType?: TitleType;
    principal?: string;
    indexCurve?: IndexCurve | null;
  } = {},
) {
  return InvestmentScenario.create({
    principal: Money.of(options.principal ?? '1000'),
    investmentDate: CalendarDate.of(options.start ?? '2026-01-02'),
    maturityDate: CalendarDate.of(options.end ?? '2026-01-06'),
    titleType: options.titleType ?? TitleType.CDB,
    remuneration: RemunerationTerms.create(
      options.kind ?? 'PREFIXED',
      Rate.of(options.rate ?? '0.12'),
    ),
    indexCurve: options.indexCurve ?? null,
  }).value;
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
    const input = scenario();
    const result = calculator.calculate(input).value;
    expect(result.methodologyVersion).toBe(METHODOLOGY_VERSION);
    expect(result.dailyBalances.map((row) => row.date.toIsoString())).toEqual([
      '2026-01-05',
      '2026-01-06',
    ]);
    const expected = 1000 * Math.pow(1.12, 2 / 252);
    expect(result.maturitySummary.grossBalance.amount.toNumber()).toBeCloseTo(
      expected,
      10,
    );
    expect(result.maturitySummary.principal.equals(input.principal)).toBe(true);
    expect(
      result.maturitySummary.grossBalance.equals(
        result.dailyBalances[1].grossBalance,
      ),
    ).toBe(true);
    let previous = input.principal;
    for (const row of result.dailyBalances) {
      expect(
        row.dailyGrossEarnings.equals(row.grossBalance.subtract(previous)),
      ).toBe(true);
      expect(
        row.accumulatedGrossEarnings.equals(
          row.grossBalance.subtract(input.principal),
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
      scenario({ end: maturity.toIsoString() }),
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
    const indexCurve = curve(EconomicIndex.CDI, [
      ['2026-04-02', '2026-04-02', '0.12'],
    ]);
    const result = calculator.calculate(
      scenario({
        kind: 'CDI_PERCENTAGE',
        rate: '1',
        start: '2026-04-02',
        end: '2026-04-06',
        indexCurve,
      }),
    ).value;
    expect(result.dailyBalances).toHaveLength(1);
    expect(result.dailyBalances[0].date.toIsoString()).toBe('2026-04-06');
    expect(result.maturitySummary.grossBalance.amount.toNumber()).toBeCloseTo(
      1000 * Math.pow(1.12, 1 / 252),
      10,
    );
    // Taxes count four calendar days across the holiday and weekend.
    expect(
      result.maturitySummary.iof.amount.equals(
        result.maturitySummary.grossEarnings.amount.times('0.86'),
      ),
    ).toBe(true);
  });

  describe.each([
    ['CDI_PERCENTAGE', EconomicIndex.CDI],
    ['SELIC_PERCENTAGE', EconomicIndex.SELIC],
  ] as const)('%s', (kind, index) => {
    it.each(['0.5', '1', '1.05', '2'])(
      'applies %s of the daily index rate',
      (rate) => {
        const result = calculator.calculate(
          scenario({ kind, rate, indexCurve: curve(index) }),
        ).value;
        const expectedFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * Number(rate);
        expect(
          result.maturitySummary.grossBalance.amount.toNumber(),
        ).toBeCloseTo(1000 * expectedFactor * expectedFactor, 10);
      },
    );

    it('uses start-date rates, excludes maturity, and needs no weekend values', () => {
      const input = scenario({
        kind,
        rate: '1.05',
        indexCurve: curve(index, [
          ['2026-01-02', '2026-01-02', '0.12'],
          ['2026-01-05', '2026-01-05', '0.20'],
        ]),
      });
      const result = calculator.calculate(input).value;
      const fridayFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * 1.05;
      const mondayFactor = 1 + (Math.pow(1.2, 1 / 252) - 1) * 1.05;
      expect(
        result.dailyBalances[0].grossBalance.amount.toNumber(),
      ).toBeCloseTo(1000 * fridayFactor, 10);
      expect(
        result.dailyBalances[1].grossBalance.amount.toNumber(),
      ).toBeCloseTo(1000 * fridayFactor * mondayFactor, 10);
      expect(calculator.calculate(input).value).toEqual(result);
    });

    it('allows an explicit zero index rate', () => {
      const result = calculator.calculate(
        scenario({
          kind,
          rate: '1',
          indexCurve: curve(index, [['2026-01-02', '2026-01-05', '0']]),
        }),
      ).value;
      expect(result.maturitySummary.grossBalance.amount.toString()).toBe(
        '1000',
      );
      expect(result.maturitySummary.totalTaxes.isZero()).toBe(true);
      expect(
        result.dailyBalances.every((row) => row.dailyGrossEarnings.isZero()),
      ).toBe(true);
    });

    it('reports every missing required reference without a partial result', () => {
      const result = calculator.calculate(
        scenario({
          kind,
          rate: '1',
          indexCurve: curve(index, [['2026-01-06', '2026-01-06', '0.12']]),
        }),
      );
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvestmentCalculationError);
      expect(result.error.code).toBe('INVESTMENT_CURVE_COVERAGE_MISSING');
      expect(result.error.metadata?.['missingReferences']).toEqual([
        '2026-01-02',
        '2026-01-05',
      ]);
    });

    it('requires the last interval start even when the investment date is covered', () => {
      const result = calculator.calculate(
        scenario({
          kind,
          rate: '1',
          indexCurve: curve(index, [['2026-01-02', '2026-01-02', '0.12']]),
        }),
      );
      expect(result.error.metadata?.['missingReferences']).toEqual([
        '2026-01-05',
      ]);
    });
  });

  it('rejects non-business investment or maturity dates', () => {
    expect(
      calculator.calculate(scenario({ start: '2026-01-03' })).error.code,
    ).toBe('INVESTMENT_DATE_NOT_BUSINESS_DAY');
  });

  it.each([TitleType.LCI, TitleType.LCA])(
    'rejects unsupported title %s',
    (titleType) => {
      expect(calculator.calculate(scenario({ titleType })).error.code).toBe(
        'INVESTMENT_TITLE_UNSUPPORTED',
      );
    },
  );

  it('returns an explicit error for deferred IPCA', () => {
    const indexCurve = curve(EconomicIndex.IPCA, [
      ['2026-01-01', '2026-01-31', '0.01'],
    ]);
    expect(
      calculator.calculate(scenario({ kind: 'IPCA_PLUS', indexCurve })).error
        .code,
    ).toBe('INVESTMENT_REMUNERATION_UNSUPPORTED');
  });

  it('preserves fractional principal precision', () => {
    const result = calculator.calculate(
      scenario({
        kind: 'SELIC_PERCENTAGE',
        rate: '1',
        principal: '1000.123456789123456',
        indexCurve: curve(EconomicIndex.SELIC, [
          ['2026-01-02', '2026-01-05', '0'],
        ]),
      }),
    ).value;
    expect(result.maturitySummary.netBalance.amount.toString()).toBe(
      '1000.123456789123456',
    );
  });

  it('returns a typed failure for numerical overflow', () => {
    const result = calculator.calculate(
      scenario({ rate: '1e1000', principal: '1e9000000000000000' }),
    );
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('INVESTMENT_CALCULATION_FAILED');
    expect(result.error.kind).toBe('unexpected');
  });
});
