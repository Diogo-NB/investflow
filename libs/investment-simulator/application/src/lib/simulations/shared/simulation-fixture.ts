// Domain builders shared by the application use-case specs.
import {
  EEconomicIndex,
  ETitleType,
  CurveInterval,
  Curve,
  IndexValue,
  InvestmentTerms,
  Offer,
  RedemptionTerms,
  RemunerationKind,
  RemunerationTerms,
  Simulation,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  InvestmentCommandInput,
  SimulationTermsCommandInput,
} from './simulation-command-input.type';

export const OWNER_ID = 'owner-id';

export function catalogOffer(ownerId: string | null = null) {
  return Offer.create(
    {
      ownerId,
      titleType: ETitleType.CDB,
      name: 'CDB prefixado',
      issuerName: 'Banco Local',
      maturityDate: CalendarDate.of('2030-01-02'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
    },
    UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  ).value;
}

export function cdiCurve(ownerId: string | null = null) {
  return Curve.create(
    {
      ownerId,
      name: 'CDI',
      index: EEconomicIndex.CDI,
      intervals: [
        CurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.of('2026-01-01'),
            CalendarDate.of('2030-01-01'),
          ),
          IndexValue.of('0.12'),
        ),
      ],
    },
    UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  ).value;
}

export function ownedSimulation(kind: RemunerationKind = 'PREFIXED') {
  return Simulation.reconstitute({
    id: 'simulation-id',
    ownerId: OWNER_ID,
    sourceOfferId: null,
    terms: InvestmentTerms.create({
      titleType: ETitleType.CDB,
      issuerName: null,
      maturityDate: CalendarDate.of('2026-02-02'),
      redemption: RedemptionTerms.create('AT_MATURITY'),
      remuneration: RemunerationTerms.create(
        kind,
        Rate.of(kind === 'PREFIXED' ? '0.12' : '1'),
      ),
    }),
    deletedAt: null,
  });
}

export function termsRequest(
  overrides: Partial<SimulationTermsCommandInput> = {},
): SimulationTermsCommandInput {
  return {
    titleType: ETitleType.CDB,
    issuerName: 'Banco Local',
    maturityDate: '2030-01-02',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
    ...overrides,
  };
}

export function investmentRequest(
  overrides: Partial<InvestmentCommandInput> = {},
): InvestmentCommandInput {
  return { principal: '1000', investmentDate: '2026-01-02', ...overrides };
}
