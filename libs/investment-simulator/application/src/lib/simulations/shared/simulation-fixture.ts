// Domain builders shared by the application use-case specs.
import {
  EEconomicIndex,
  ETitleType,
  CurveInterval,
  Curve,
  IndexValue,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  InvestmentInputs,
  Simulation,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { CreateOfferCommandInput } from '../../offers/shared/offer-command-input.type';
import { InvestmentCommandInput } from './simulation-command-input.type';

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

// Reconstituted, as repositories return it, at revision 1 without a result.
export function ownedSimulation(offerId = 'offer-id') {
  return Simulation.reconstitute({
    id: 'simulation-id',
    ownerId: OWNER_ID,
    offerId,
    investment: InvestmentInputs.create({
      principal: Money.of('1000'),
      investmentDate: CalendarDate.of('2026-01-02'),
      curveId: null,
    }),
    revision: 1,
    result: null,
    deletedAt: null,
  });
}

export function newOfferRequest(
  overrides: Partial<CreateOfferCommandInput> = {},
): CreateOfferCommandInput {
  return {
    titleType: ETitleType.CDB,
    name: 'CDB digitado',
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
