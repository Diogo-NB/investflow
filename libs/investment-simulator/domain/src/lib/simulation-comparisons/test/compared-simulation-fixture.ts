import { CalendarDate, Money } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ETitleType } from '../../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { SimulationResult } from '../../simulations/simulation-result.vo';
import {
  ComparedResult,
  ComparedSimulation,
  ComparedSimulationProps,
} from '../compared-simulation.vo';

export const REVISION = 2;

export function comparedResult(
  overrides: Partial<ComparedResult> = {},
): ComparedResult {
  return {
    inputs: SimulationResult.targetFor(REVISION, ETitleType.CDB, 1, null),
    principal: Money.of('10000'),
    investmentDate: CalendarDate.of('2026-01-02'),
    maturityDate: CalendarDate.of('2028-01-03'),
    netFinalBalance: Money.of('12000'),
    netAnnualReturn: new Decimal('0.1'),
    ...overrides,
  };
}

// Calculated from its current premises unless overridden.
export function comparedSimulation(
  id: string,
  lastResult: ComparedResult | null = comparedResult(),
  overrides: Partial<Omit<ComparedSimulationProps, 'id' | 'lastResult'>> = {},
): ComparedSimulation {
  return ComparedSimulation.create({
    id,
    calculationStatus: ESimulationCalculationStatus.CALCULATED,
    simulationRevision: REVISION,
    titleType: ETitleType.CDB,
    offerTermsRevision: 1,
    curveValuesRevision: null,
    lastResult,
    ...overrides,
  });
}
