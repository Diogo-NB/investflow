import { Money } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import {
  comparedResult,
  comparedSimulation,
  inputFingerprint,
  REVISION,
} from './compared-simulation-fixture';

describe('ComparedSimulation', () => {
  it('is settled when calculated from its current premises', () => {
    const simulation = comparedSimulation('a');

    expect(simulation.isResultCurrent).toBe(true);
    expect(simulation.isSettled).toBe(true);
  });

  it('has a stale result once its premises changed', () => {
    const simulation = comparedSimulation('a', comparedResult(), {
      currentInputFingerprint: inputFingerprint(REVISION + 1),
    });

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
          comparedResult({ inputFingerprint: inputFingerprint(1) }),
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
