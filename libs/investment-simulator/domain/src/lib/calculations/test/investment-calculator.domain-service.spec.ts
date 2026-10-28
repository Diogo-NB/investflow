import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  Money,
  Rate,
  UtcInstant,
  BusinessDayCalendar,
} from '@investflow/shared-domain';
import { EEconomicIndex } from '../../curves/economic-index.enum';
import { Curve } from '../../curves/curve.aggregate';
import { CurveInterval } from '../../curves/curve-interval.vo';
import { IndexValue } from '../../curves/index-value.vo';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../../offers/terms/remuneration/remuneration-terms.vo';
import { ETitleType } from '../../offers/title-type.enum';
import { InvestmentCalculationError } from '../investment-calculation.error';
import { InvestmentCalculator } from '../investment-calculator.domain-service';
import { InvestmentScenario } from '../investment-scenario.vo';
import Decimal from 'decimal.js';

const calculator = new InvestmentCalculator();

function scenario(
  options: {
    kind?: RemunerationKind;
    rate?: string;
    start?: string;
    end?: string;
    titleType?: ETitleType;
    principal?: string;
    curve?: Curve | null;
  } = {},
) {
  return InvestmentScenario.create({
    principal: Money.of(options.principal ?? '1000'),
    investmentDate: CalendarDate.of(options.start ?? '2026-01-02'),
    maturityDate: CalendarDate.of(options.end ?? '2026-01-06'),
    titleType: options.titleType ?? ETitleType.CDB,
    remuneration: RemunerationTerms.create(
      options.kind ?? 'PREFIXED',
      Rate.of(options.rate ?? '0.12'),
    ),
    curve: options.curve ?? null,
  }).value;
}

function curve(
  index: EEconomicIndex,
  intervals: readonly [string, string, string][] = [
    ['2026-01-02', '2026-01-05', '0.12'],
  ],
) {
  return Curve.create(
    {
      ownerId: null,
      name: 'Scenario',
      index,
      intervals: intervals.map(([start, end, rate]) =>
        CurveInterval.create(
          CalendarDateRange.of(CalendarDate.of(start), CalendarDate.of(end)),
          IndexValue.of(rate),
        ),
      ),
    },
    UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  ).value;
}

describe('InvestmentCalculator domain service', () => {
  it('returns gross daily balances and a separate maturity tax summary', () => {
    const input = scenario();
    const result = calculator.calculate(input).value;
    expect(result.methodologyVersion).toBe('cdb-252-v1');
    expect(result.dailyBalances.map((row) => row.date.toIsoString())).toEqual([
      '2026-01-05',
      '2026-01-06',
    ]);
    const expected = 1000 * Math.pow(1.12, 2 / 252);
    expect(result.gross.finalBalance.amount.toNumber()).toBeCloseTo(
      expected,
      10,
    );
    expect(result.principal.equals(input.principal)).toBe(true);
    expect(
      result.gross.finalBalance.equals(result.dailyBalances[1].grossBalance),
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
      result.taxes.iof.amount.amount.equals(
        result.gross.earnings.amount.times('0.86'),
      ),
    ).toBe(true);
    expect(
      result.taxes.incomeTax.amount.amount.equals(
        result.gross.earnings.amount
          .minus(result.taxes.iof.amount.amount)
          .times('0.225'),
      ),
    ).toBe(true);
    expect(
      result.net.finalBalance.equals(
        result.gross.finalBalance.subtract(result.taxes.total),
      ),
    ).toBe(true);
    expect(result.gross.finalBalance.amount.decimalPlaces()).toBeGreaterThan(2);
  });

  it('compounds a fixed annual rate over 252 business days', () => {
    const start = CalendarDate.of('2026-01-02');
    let maturity = start;
    let count = 0;
    while (count < 252) {
      maturity = maturity.addDays(1);
      if (BusinessDayCalendar.isBusinessDay(maturity)) count++;
    }
    const result = calculator.calculate(
      scenario({ end: maturity.toIsoString() }),
    ).value;
    expect(result.dailyBalances).toHaveLength(252);
    expect(
      result.gross.finalBalance.amount
        .minus(1120)
        .abs()
        .lessThan('0.000000000001'),
    ).toBe(true);
  });

  it.each([
    [ETitleType.CDB, '0.099'],
    [ETitleType.LCI, '0.12'],
    [ETitleType.LCA, '0.12'],
  ])(
    'projects the %s term and its gross and net rates of return',
    (titleType, netAnnual) => {
      const result = calculator.calculate(
        scenario({ titleType, end: '2027-01-07' }),
      ).value;
      expect(result.term.businessDays).toBe(252);
      // A year of 370 calendar days, in the 17.5% income-tax bracket.
      expect(result.term.calendarDays).toBe(370);
      const gross = result.gross.rateOfReturn;
      const net = result.net.rateOfReturn;
      expect(gross.annual.toFixed(12)).toBe('0.120000000000');
      expect(gross.forPeriod.toFixed(12)).toBe('0.120000000000');
      expect(net.annual.toFixed(12)).toBe(new Decimal(netAnnual).toFixed(12));
      expect(
        result.net.finalBalance.equals(
          result.gross.finalBalance.subtract(result.taxes.total),
        ),
      ).toBe(true);
    },
  );

  it('skips Good Friday and the weekend without adding accrual periods', () => {
    const cdi = curve(EEconomicIndex.CDI, [
      ['2026-04-02', '2026-04-02', '0.12'],
    ]);
    const result = calculator.calculate(
      scenario({
        kind: 'CDI_PERCENTAGE',
        rate: '1',
        start: '2026-04-02',
        end: '2026-04-06',
        curve: cdi,
      }),
    ).value;
    expect(result.dailyBalances).toHaveLength(1);
    expect(result.dailyBalances[0].date.toIsoString()).toBe('2026-04-06');
    expect(result.gross.finalBalance.amount.toNumber()).toBeCloseTo(
      1000 * Math.pow(1.12, 1 / 252),
      10,
    );
    // Taxes count four calendar days across the holiday and weekend.
    expect(
      result.taxes.iof.amount.amount.equals(
        result.gross.earnings.amount.times('0.86'),
      ),
    ).toBe(true);
  });

  describe.each([
    ['CDI_PERCENTAGE', EEconomicIndex.CDI],
    ['SELIC_PERCENTAGE', EEconomicIndex.SELIC],
  ] as const)('%s', (kind, index) => {
    it.each(['0.5', '1', '1.05', '2'])(
      'applies %s of the daily index rate',
      (rate) => {
        const result = calculator.calculate(
          scenario({ kind, rate, curve: curve(index) }),
        ).value;
        const expectedFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * Number(rate);
        expect(result.gross.finalBalance.amount.toNumber()).toBeCloseTo(
          1000 * expectedFactor * expectedFactor,
          10,
        );
      },
    );

    it('uses start-date rates, excludes maturity, and needs no weekend values', () => {
      const input = scenario({
        kind,
        rate: '1.05',
        curve: curve(index, [
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
          curve: curve(index, [['2026-01-02', '2026-01-05', '0']]),
        }),
      ).value;
      expect(result.gross.finalBalance.amount.toString()).toBe('1000');
      expect(result.taxes.total.isZero).toBe(true);
      expect(
        result.dailyBalances.every((row) => row.dailyGrossEarnings.isZero),
      ).toBe(true);
    });

    it('reports every missing required reference without a partial result', () => {
      const result = calculator.calculate(
        scenario({
          kind,
          rate: '1',
          curve: curve(index, [['2026-01-06', '2026-01-06', '0.12']]),
        }),
      );
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvestmentCalculationError);
      expect(result.error.code).toBe(
        EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
      );
      // 2026-01-02 and 2026-01-05 are consecutive business-day references.
      expect(result.error.metadata?.['missingRanges']).toEqual([
        { start: '2026-01-02', end: '2026-01-05' },
      ]);
    });

    it("uses the last interval's value after its end", () => {
      const held = calculator.calculate(
        scenario({
          kind,
          rate: '1',
          curve: curve(index, [['2026-01-02', '2026-01-02', '0.12']]),
        }),
      ).value;
      const covered = calculator.calculate(
        scenario({ kind, rate: '1', curve: curve(index) }),
      ).value;
      expect(held.gross.finalBalance.equals(covered.gross.finalBalance)).toBe(
        true,
      );
    });
  });

  it('rejects non-business investment or maturity dates', () => {
    expect(
      calculator.calculate(scenario({ start: '2026-01-03' })).error.code,
    ).toBe(EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY);
  });

  describe('check', () => {
    it('accepts a supported scenario on business days without reading rates', () => {
      expect(
        calculator
          .check(
            scenario({
              kind: 'CDI_PERCENTAGE',
              end: '2026-03-06',
              curve: curve(EEconomicIndex.CDI),
            }),
          )
          .isOk(),
      ).toBe(true);
    });

    it('rejects non-business dates and unsupported remuneration', () => {
      expect(calculator.check(scenario({ start: '2026-01-03' })).error).toEqual(
        expect.objectContaining({
          code: EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
          metadata: { field: 'investmentDate', date: '2026-01-03' },
        }),
      );
      expect(
        calculator.check(scenario({ end: '2026-01-10' })).error.metadata,
      ).toEqual({ field: 'maturityDate', date: '2026-01-10' });
      const ipca = curve(EEconomicIndex.IPCA, [
        ['2026-01-01', '2026-01-31', '0.01'],
      ]);
      expect(
        calculator.check(scenario({ kind: 'IPCA_PLUS', curve: ipca })).error
          .code,
      ).toBe(EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED);
    });
  });

  it.each([
    [ETitleType.LCI, 'lci-252-v1'],
    [ETitleType.LCA, 'lca-252-v1'],
  ])('accrues %s like a CDB, without income tax', (titleType, version) => {
    const dates = { start: '2026-01-02', end: '2026-10-02' };
    const cdb = calculator.calculate(scenario(dates)).value;
    const result = calculator.calculate(
      scenario({ ...dates, titleType }),
    ).value;
    expect(result.methodologyVersion).toBe(version);
    expect(result.gross.finalBalance.equals(cdb.gross.finalBalance)).toBe(true);
    expect(result.taxes.incomeTax.rate).toBeNull();
    expect(result.taxes.total.isZero).toBe(true);
    expect(result.net.finalBalance.equals(result.gross.finalBalance)).toBe(
      true,
    );
    expect(cdb.taxes.total.isPositive).toBe(true);
  });

  it('returns an explicit error for deferred IPCA', () => {
    const ipca = curve(EEconomicIndex.IPCA, [
      ['2026-01-01', '2026-01-31', '0.01'],
    ]);
    expect(
      calculator.calculate(scenario({ kind: 'IPCA_PLUS', curve: ipca })).error
        .code,
    ).toBe(EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED);
  });

  it('preserves fractional principal precision', () => {
    const result = calculator.calculate(
      scenario({
        kind: 'SELIC_PERCENTAGE',
        rate: '1',
        principal: '1000.123456789123456',
        curve: curve(EEconomicIndex.SELIC, [['2026-01-02', '2026-01-05', '0']]),
      }),
    ).value;
    expect(result.net.finalBalance.amount.toString()).toBe(
      '1000.123456789123456',
    );
  });

  it('returns a typed failure for numerical overflow', () => {
    const result = calculator.calculate(
      scenario({ rate: '1e1000', principal: '1e9000000000000000' }),
    );
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_CALCULATION_FAILED);
    expect(result.error.kind).toBe('unexpected');
  });

  describe('accrual periods', () => {
    const balanceDates = (start: string, end: string) =>
      calculator
        .calculate(scenario({ start, end }))
        .value.dailyBalances.map(({ date }) => date.toIsoString());

    it('chains business days across Carnival holidays', () => {
      expect(balanceDates('2026-02-13', '2026-02-19')).toEqual([
        '2026-02-18',
        '2026-02-19',
      ]);
    });

    it('crosses the year boundary without accruing on New Year', () => {
      expect(balanceDates('2025-12-31', '2026-01-02')).toEqual(['2026-01-02']);
    });

    it.each([
      ['2026-01-03', '2026-01-06', 'investmentDate'],
      ['2026-01-02', '2026-01-04', 'maturityDate'],
      ['2026-04-03', '2026-04-06', 'investmentDate'],
      ['2026-04-02', '2026-04-03', 'maturityDate'],
    ])('rejects non-business dates %s to %s', (start, end, field) => {
      const error = calculator.calculate(scenario({ start, end })).error;
      expect(error.code).toBe(EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY);
      expect(error.metadata?.['field']).toBe(field);
    });
  });

  describe('unsupportedReason', () => {
    it.each(['PREFIXED', 'CDI_PERCENTAGE', 'SELIC_PERCENTAGE'] as const)(
      'supports %s',
      (kind) => {
        expect(InvestmentCalculator.unsupportedReason(kind)).toBeNull();
      },
    );

    it('defers IPCA+ remuneration', () => {
      expect(InvestmentCalculator.unsupportedReason('IPCA_PLUS')).toBe(
        EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED,
      );
    });
  });
});
