import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculator } from '../calculations/investment-calculator.domain-service';
import { EEconomicIndex } from '../curves/economic-index.enum';
import { Curve } from '../curves/curve.aggregate';
import { CurveInterval } from '../curves/curve-interval.vo';
import { IndexValue } from '../curves/index-value.vo';
import { Offer } from '../offers/offer.aggregate';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { ETitleType } from '../offers/title-type.enum';
import { InvestmentInputs } from './investment-inputs.vo';
import { SimulationCalculationService } from './simulation-calculation.domain-service';
import {
  ESimulationCalculationCauseKind,
  SimulationCalculationCause,
} from './simulation-calculation.vo';

export const CALCULATED_AT = UtcInstant.ofIso('2026-10-10T12:00:00Z');

export const calculator = new InvestmentCalculator(
  new BrazilianBusinessDayCalendar(),
);

export const calculationService = new SimulationCalculationService(calculator);

export function cause(
  kind: ESimulationCalculationCauseKind = ESimulationCalculationCauseKind.CREATED,
): SimulationCalculationCause {
  return { kind, refId: null, actorId: 'owner-id' };
}

export function cdiCurve(): Curve {
  return Curve.create(
    {
      ownerId: null,
      name: 'CDI',
      index: EEconomicIndex.CDI,
      intervals: [
        CurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.of('2026-01-01'),
            CalendarDate.of('2026-01-31'),
          ),
          IndexValue.of('0.0005'),
        ),
      ],
    },
    UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  ).value;
}

export function offer(
  kind: RemunerationKind = 'PREFIXED',
  ownerId: string | null = null,
  maturityDate = '2026-01-06',
): Offer {
  return Offer.create(
    {
      titleType: ETitleType.CDB,
      ownerId,
      name: 'CDB Banco Local',
      issuerName: 'Banco Local',
      maturityDate: CalendarDate.of(maturityDate),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create(
        kind,
        Rate.of(kind === 'PREFIXED' ? '0.12' : '1'),
      ),
    },
    UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  ).value;
}

export function investment(
  overrides: {
    curveId?: string | null;
    principal?: Money;
    investmentDate?: string;
  } = {},
): InvestmentInputs {
  return InvestmentInputs.create({
    principal: overrides.principal ?? Money.of('1000'),
    investmentDate: CalendarDate.of(overrides.investmentDate ?? '2026-01-02'),
    curveId: overrides.curveId ?? null,
  });
}
