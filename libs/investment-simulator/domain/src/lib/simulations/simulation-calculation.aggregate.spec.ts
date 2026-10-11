import { ETitleType } from '../offers/title-type.enum';
import { SimulationCalculation } from './simulation-calculation.aggregate';
import {
  CALCULATED_AT,
  calculator,
  investment,
  terms,
} from './simulation-fixture';
import { Simulation } from './simulation.aggregate';

function recorded() {
  return Simulation.start({
    ownerId: 'owner-id',
    sourceOfferId: null,
    terms: terms(),
    investment: investment(),
    curve: null,
    calculator,
    calculatedAt: CALCULATED_AT,
  }).value.calculation;
}

describe('SimulationCalculation', () => {
  it('gives each calculation its own identity', () => {
    const calculation = recorded();
    const again = SimulationCalculation.record({
      simulationId: calculation.simulationId,
      investment: calculation.investment,
      result: calculation.result,
      calculatedAt: calculation.calculatedAt,
    });

    expect(again.id).not.toBe(calculation.id);
  });

  it('reconstitutes the stored record', () => {
    const calculation = recorded();

    const restored = SimulationCalculation.reconstitute({
      id: 'calculation-id',
      simulationId: calculation.simulationId,
      investment: calculation.investment,
      result: calculation.result,
      calculatedAt: calculation.calculatedAt,
    });

    expect(restored.id).toBe('calculation-id');
    expect(restored.result).toBe(calculation.result);
    expect(restored.result.methodologyVersion).toBe('cdb-252-v1');
  });

  it('is outdated only under another methodology', () => {
    expect(SimulationCalculation.isOutdated(ETitleType.CDB, 'cdb-252-v1')).toBe(
      false,
    );
    expect(SimulationCalculation.isOutdated(ETitleType.CDB, 'cdb-252-v0')).toBe(
      true,
    );
    expect(SimulationCalculation.isOutdated(ETitleType.LCI, 'lci-252-v1')).toBe(
      false,
    );
    expect(SimulationCalculation.isOutdated(ETitleType.LCA, 'cdb-252-v1')).toBe(
      true,
    );
  });
});
