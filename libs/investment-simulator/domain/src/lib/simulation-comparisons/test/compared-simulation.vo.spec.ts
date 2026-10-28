import { Money } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ETitleType } from '../../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { SimulationResult } from '../../simulations/simulation-result.vo';
import {
  comparedResult,
  comparedSimulation,
  REVISION,
} from './compared-simulation-fixture';

describe('ComparedSimulation', () => {
  it('is settled when calculated from its current premises', () => {
    const simulation = comparedSimulation('a');

    expect(simulation.isResultCurrent).toBe(true);
    expect(simulation.isSettled).toBe(true);
  });

  it.each([
    ['the simulation', { simulationRevision: REVISION + 1 }],
    ['the offer terms', { offerTermsRevision: 2 }],
    ['the curve values', { curveValuesRevision: 1 }],
    ['the methodology of the title type', { titleType: ETitleType.LCI }],
  ])('has a stale result after %s changed', (_, change) => {
    const simulation = comparedSimulation('a', comparedResult(), change);

    expect(simulation.isResultCurrent).toBe(false);
    expect(simulation.isSettled).toBe(false);
  });

  it.each([
    ESimulationCalculationStatus.PENDING,
    ESimulationCalculationStatus.INVALID,
    ESimulationCalculationStatus.FAILED,
  ])('is not settled while %s, even with a current result', (status) => {
    const simulation = comparedSimulation('a', comparedResult(), {
      calculationStatus: status,
    });

    expect(simulation.isResultCurrent).toBe(true);
    expect(simulation.isSettled).toBe(false);
  });

  it('has no current result without a result', () => {
    const simulation = comparedSimulation('a', null);

    expect(simulation.isResultCurrent).toBe(false);
    expect(simulation.isSettled).toBe(false);
  });

  it('compares by value', () => {
    expect(comparedSimulation('a').equals(comparedSimulation('a'))).toBe(true);
    expect(comparedSimulation('a').equals(comparedSimulation('b'))).toBe(false);
    expect(
      comparedSimulation('a').equals(
        comparedSimulation(
          'a',
          comparedResult({ netAnnualReturn: new Decimal('0.11') }),
        ),
      ),
    ).toBe(false);
    expect(
      comparedSimulation('a').equals(
        comparedSimulation(
          'a',
          comparedResult({
            inputs: SimulationResult.targetFor(1, ETitleType.CDB, 1, null),
          }),
        ),
      ),
    ).toBe(false);
    expect(
      comparedSimulation('a', null).equals(
        comparedSimulation('a', comparedResult({ principal: Money.of('1') })),
      ),
    ).toBe(false);
    expect(
      comparedSimulation('a', null).equals(comparedSimulation('a', null)),
    ).toBe(true);
  });
});
