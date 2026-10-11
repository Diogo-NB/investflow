import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { EEconomicIndex } from '../index-curves/economic-index.enum';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { IndexCurveInterval } from '../index-curves/index-curve-interval.vo';
import { IndexValue } from '../index-curves/index-value.vo';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { ETitleType } from '../offers/title-type.enum';
import { InvestmentScenario } from './investment-scenario.vo';

function curve(index: EEconomicIndex) {
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
  principal = Money.of('1000'),
  titleType = ETitleType.CDB,
) {
  return InvestmentScenario.create({
    principal,
    investmentDate: CalendarDate.of(dates.start ?? '2026-01-02'),
    maturityDate: CalendarDate.of(dates.end ?? '2026-01-06'),
    titleType,
    remuneration: RemunerationTerms.create(kind, Rate.of('1')),
    indexCurve,
  });
}

describe('InvestmentScenario', () => {
  it.each(['0', '-1'])('rejects a principal of %s', (amount) => {
    expect(create('PREFIXED', null, {}, Money.of(amount)).error.code).toBe(
      EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID,
    );
  });

  it('rejects a principal outside BRL', () => {
    expect(
      create('PREFIXED', null, {}, Money.of('1000', 'USD')).error.code,
    ).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
  });

  it.each([ETitleType.LCI, ETitleType.LCA])(
    'requires %s to mature at least nine months after the investment',
    (titleType) => {
      const at = (end: string) =>
        create(
          'PREFIXED',
          null,
          { start: '2026-05-31', end },
          undefined,
          titleType,
        );
      const error = at('2027-02-27').error;
      expect(error.code).toBe(EAppErrorCode.INVESTMENT_TERM_TOO_SHORT);
      expect(error.metadata).toEqual({
        titleType,
        minimumMaturityDate: '2027-02-28',
      });
      expect(at('2027-02-28').isOk()).toBe(true);
    },
  );

  it('has no minimum term for a CDB', () => {
    expect(create('PREFIXED', null, { end: '2026-01-05' }).isOk()).toBe(true);
  });

  it('counts holding calendar days excluding the investment date', () => {
    expect(create('PREFIXED', null).value.holdingPeriodCalendarDays).toBe(4);
  });

  it.each([
    ['2026-01-06', '2026-01-06'],
    ['2026-01-07', '2026-01-06'],
  ])('rejects investing on %s for maturity %s', (start, end) => {
    expect(create('PREFIXED', null, { start, end }).error.code).toBe(
      EAppErrorCode.INVESTMENT_PERIOD_INVALID,
    );
  });

  it('pairs each remuneration with the curve of its own index only', () => {
    const pairs: [RemunerationKind, EEconomicIndex][] = [
      ['CDI_PERCENTAGE', EEconomicIndex.CDI],
      ['SELIC_PERCENTAGE', EEconomicIndex.SELIC],
      ['IPCA_PLUS', EEconomicIndex.IPCA],
    ];
    for (const [kind, index] of pairs) {
      expect(create(kind, curve(index)).isOk()).toBe(true);
      expect(create(kind, null).error.code).toBe(
        EAppErrorCode.INVESTMENT_CURVE_REQUIRED,
      );
      for (const [, otherIndex] of pairs.filter(([, i]) => i !== index)) {
        expect(create(kind, curve(otherIndex)).error.code).toBe(
          EAppErrorCode.INVESTMENT_CURVE_INCOMPATIBLE,
        );
      }
    }
  });

  it('rejects a curve for a fixed rate', () => {
    expect(create('PREFIXED', curve(EEconomicIndex.CDI)).error.code).toBe(
      EAppErrorCode.INVESTMENT_CURVE_INCOMPATIBLE,
    );
  });

  it('rejects a deleted curve', () => {
    const deleted = curve(EEconomicIndex.CDI).delete(
      UtcInstant.ofIso('2026-10-06T12:00:00Z'),
    );
    expect(create('CDI_PERCENTAGE', deleted).error.code).toBe(
      EAppErrorCode.INVESTMENT_CURVE_UNAVAILABLE,
    );
  });

  it('exposes the curve only through the indexed invariant', () => {
    const cdi = curve(EEconomicIndex.CDI);
    expect(create('CDI_PERCENTAGE', cdi).value.requireIndexCurve()).toBe(cdi);
    expect(() => create('PREFIXED', null).value.requireIndexCurve()).toThrow();
  });
});
