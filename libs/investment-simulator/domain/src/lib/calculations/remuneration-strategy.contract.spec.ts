import {
  CalendarDate,
  CalendarDateRange,
  Rate,
} from '@investflow/shared-domain';
import { EconomicIndex } from '../index-curves/economic-index.enum';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { IndexCurveInterval } from '../index-curves/index-curve-interval.vo';
import { IndexValue } from '../index-curves/index-value.vo';
import { RemunerationTerms } from '../offers/terms/remuneration/remuneration-terms.vo';
import { CdiPercentageRemunerationStrategy } from './cdi-percentage-remuneration.strategy';
import { PrefixedRemunerationStrategy } from './prefixed-remuneration.strategy';
import { SelicPercentageRemunerationStrategy } from './selic-percentage-remuneration.strategy';

const accruals = [
  {
    rateReferenceDate: CalendarDate.of('2026-01-02'),
    balanceDate: CalendarDate.of('2026-01-05'),
  },
  {
    rateReferenceDate: CalendarDate.of('2026-01-05'),
    balanceDate: CalendarDate.of('2026-01-06'),
  },
];

describe.each([
  [new PrefixedRemunerationStrategy(), undefined, '0.12', 1],
  [new CdiPercentageRemunerationStrategy(), EconomicIndex.CDI, '1.05', 1.05],
  [
    new SelicPercentageRemunerationStrategy(),
    EconomicIndex.SELIC,
    '1.05',
    1.05,
  ],
] as const)(
  'Remuneration strategy contract: %s',
  (strategy, index, rate, percentage) => {
    it('preserves rate reference and balance dates when the same rate is reused', () => {
      const indexCurve =
        index === undefined
          ? undefined
          : IndexCurve.create({
              name: 'Constant scenario',
              index,
              intervals: [
                IndexCurveInterval.create(
                  CalendarDateRange.of(
                    accruals[0].rateReferenceDate,
                    accruals[1].rateReferenceDate,
                  ),
                  IndexValue.of('0.12'),
                ),
              ],
            }).value;
      const result = strategy.prepare({
        terms: RemunerationTerms.create(strategy.kind, Rate.of(rate)),
        accruals,
        indexCurve,
      }).value;
      expect(result).toHaveLength(2);
      expect(
        result.map(({ rateReferenceDate, balanceDate }) => ({
          rateReferenceDate,
          balanceDate,
        })),
      ).toEqual(accruals);
      expect(
        result.map(({ balanceDate }) => balanceDate.toIsoString()),
      ).toEqual(['2026-01-05', '2026-01-06']);
      const expectedFactor = 1 + (Math.pow(1.12, 1 / 252) - 1) * percentage;
      for (const accrual of result) {
        expect(accrual.factor.toNumber()).toBeCloseTo(expectedFactor, 14);
      }
    });

    it('rejects terms belonging to another remuneration kind', () => {
      const result = strategy.prepare({
        terms: RemunerationTerms.create('IPCA_PLUS', Rate.of('0.06')),
        accruals,
      });
      expect(result.error.code).toBe('INVESTMENT_REMUNERATION_UNSUPPORTED');
    });
  },
);
