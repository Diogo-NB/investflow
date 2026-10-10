// Domain builders shared by the application use-case specs.
import {
  EEconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  Issuer,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  Rate,
} from '@investflow/shared-domain';
import { SimulationInputsCommandInput } from './simulation-command-input.type';

export const OWNER_ID = 'owner-id';

export function catalogOffer() {
  return Offer.create({
    titleType: ETitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: CalendarDate.of('2030-01-02'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
  });
}

export function issuer() {
  return Issuer.create({ name: 'Banco' });
}

export function cdiCurve() {
  return IndexCurve.create({
    name: 'Base',
    index: EEconomicIndex.CDI,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-01-01'),
          CalendarDate.of('2030-01-01'),
        ),
        IndexValue.of('0.12'),
      ),
    ],
  }).value;
}

export function ownedSimulation() {
  return Simulation.create({ ownerId: OWNER_ID, sourceOfferId: null });
}

export function inputsRequest(
  overrides: Partial<SimulationInputsCommandInput> = {},
): SimulationInputsCommandInput {
  return {
    principal: '1000',
    investmentDate: '2026-01-02',
    issuerId: 'issuer-id',
    maturityDate: '2030-01-02',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
    ...overrides,
  };
}
