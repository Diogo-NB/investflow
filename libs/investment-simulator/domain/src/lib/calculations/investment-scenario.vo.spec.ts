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
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { TitleType } from '../offers/title-type.enum';
import { InvestmentScenario } from './investment-scenario.vo';

function curve(index: EconomicIndex) {
  return IndexCurve.create({
    name: 'Scenario',
    index,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-01-01'),
          CalendarDate.of('2026-01-31'),
        ),
        IndexValue.of('0.01'),
      ),
    ],
  }).value;
}

function create(
  kind: RemunerationKind,
  indexCurve: IndexCurve | null,
  dates: { start?: string; end?: string } = {},
) {
  return InvestmentScenario.create({
    principal: Money.of('1000'),
    investmentDate: CalendarDate.of(dates.start ?? '2026-01-02'),
    maturityDate: CalendarDate.of(dates.end ?? '2026-01-06'),
    titleType: TitleType.CDB,
    remuneration: RemunerationTerms.create(kind, Rate.of('1')),
    indexCurve,
  });
}

describe('InvestmentScenario', () => {
  it('counts holding calendar days excluding the investment date', () => {
    expect(create('PREFIXED', null).value.holdingPeriodCalendarDays).toBe(4);
  });

  it.each([
    ['2026-01-06', '2026-01-06'],
    ['2026-01-07', '2026-01-06'],
  ])('rejects investing on %s for maturity %s', (start, end) => {
    expect(create('PREFIXED', null, { start, end }).error.code).toBe(
      'INVESTMENT_PERIOD_INVALID',
    );
  });

  it('pairs each remuneration with the curve of its own index only', () => {
    const pairs: [RemunerationKind, EconomicIndex][] = [
      ['CDI_PERCENTAGE', EconomicIndex.CDI],
      ['SELIC_PERCENTAGE', EconomicIndex.SELIC],
      ['IPCA_PLUS', EconomicIndex.IPCA],
    ];
    for (const [kind, index] of pairs) {
      expect(create(kind, curve(index)).isOk()).toBe(true);
      expect(create(kind, null).error.code).toBe('INVESTMENT_CURVE_REQUIRED');
      for (const [, otherIndex] of pairs.filter(([, i]) => i !== index)) {
        expect(create(kind, curve(otherIndex)).error.code).toBe(
          'INVESTMENT_CURVE_INCOMPATIBLE',
        );
      }
    }
  });

  it('rejects a curve for a fixed rate', () => {
    expect(create('PREFIXED', curve(EconomicIndex.CDI)).error.code).toBe(
      'INVESTMENT_CURVE_INCOMPATIBLE',
    );
  });

  it('rejects a deleted curve', () => {
    const deleted = curve(EconomicIndex.CDI).delete(
      UtcInstant.ofIso('2026-10-06T12:00:00Z'),
    );
    expect(create('CDI_PERCENTAGE', deleted).error.code).toBe(
      'INVESTMENT_CURVE_UNAVAILABLE',
    );
  });

  it('exposes the curve only through the indexed invariant', () => {
    const cdi = curve(EconomicIndex.CDI);
    expect(create('CDI_PERCENTAGE', cdi).value.requireIndexCurve()).toBe(cdi);
    expect(() => create('PREFIXED', null).value.requireIndexCurve()).toThrow();
  });
});
