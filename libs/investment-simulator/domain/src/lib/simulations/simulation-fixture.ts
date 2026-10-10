import {
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
} from '@investflow/shared-domain';
import { EEconomicIndex } from '../index-curves/economic-index.enum';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { IndexCurveInterval } from '../index-curves/index-curve-interval.vo';
import { IndexValue } from '../index-curves/index-value.vo';
import { InvestmentTerms } from '../offers/terms/investment-terms.vo';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { ETitleType } from '../offers/title-type.enum';
import { SimulationInputs } from './simulation-inputs.vo';

export function cdiCurve(): IndexCurve {
  return IndexCurve.create({
    name: 'CDI',
    index: EEconomicIndex.CDI,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-01-01'),
          CalendarDate.of('2026-01-31'),
        ),
        IndexValue.of('0.0005'),
      ),
    ],
  }).value;
}

export function simulationInputs(
  kind: RemunerationKind = 'PREFIXED',
  overrides: { indexCurveId?: string | null; principal?: Money } = {},
): SimulationInputs {
  return SimulationInputs.create({
    terms: InvestmentTerms.create({
      titleType: ETitleType.CDB,
      issuerId: 'issuer-id',
      maturityDate: CalendarDate.of('2026-01-06'),
      redemption: RedemptionTerms.create('AT_MATURITY'),
      remuneration: RemunerationTerms.create(
        kind,
        Rate.of(kind === 'PREFIXED' ? '0.12' : '1'),
      ),
    }),
    principal: overrides.principal ?? Money.of('1000'),
    investmentDate: CalendarDate.of('2026-01-02'),
    indexCurveId: overrides.indexCurveId ?? null,
  });
}
