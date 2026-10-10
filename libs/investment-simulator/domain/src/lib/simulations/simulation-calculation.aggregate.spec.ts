import {
  BrazilianBusinessDayCalendar,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  InvestmentCalculator,
  METHODOLOGY_VERSION,
} from '../calculations/investment-calculator.domain-service';
import { Simulation } from './simulation.aggregate';
import { SimulationCalculation } from './simulation-calculation.aggregate';
import { simulationInputs } from './simulation-fixture';

const CALCULATED_AT = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function calculated() {
  const simulation = Simulation.create({
    ownerId: 'owner-id',
    sourceOfferId: null,
  });
  const inputs = simulationInputs();
  const result = new InvestmentCalculator(
    new BrazilianBusinessDayCalendar(),
  ).calculate(inputs.toScenario(null).value).value;
  return { simulation, inputs, result };
}

describe('SimulationCalculation', () => {
  it('records the inputs and the result of one calculation', () => {
    const { simulation, inputs, result } = calculated();

    const calculation = SimulationCalculation.record({
      simulation,
      inputs,
      result,
      calculatedAt: CALCULATED_AT,
    }).value;

    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.inputs).toBe(inputs);
    expect(calculation.result).toBe(result);
    expect(calculation.result.methodologyVersion).toBe(METHODOLOGY_VERSION);
    expect(calculation.calculatedAt).toBe(CALCULATED_AT);
  });

  it('gives each calculation its own identity', () => {
    const props = { ...calculated(), calculatedAt: CALCULATED_AT };

    expect(SimulationCalculation.record(props).value.id).not.toBe(
      SimulationCalculation.record(props).value.id,
    );
  });

  it('rejects calculating a deleted simulation', () => {
    const { simulation, inputs, result } = calculated();
    simulation.delete(CALCULATED_AT);

    const recorded = SimulationCalculation.record({
      simulation,
      inputs,
      result,
      calculatedAt: CALCULATED_AT,
    });

    expect(recorded.error.code).toBe(EAppErrorCode.SIMULATION_DELETED);
  });

  it('reconstitutes the stored record', () => {
    const { simulation, inputs, result } = calculated();

    const calculation = SimulationCalculation.reconstitute({
      id: 'calculation-id',
      simulationId: simulation.id,
      inputs,
      result,
      calculatedAt: CALCULATED_AT,
    });

    expect(calculation.id).toBe('calculation-id');
    expect(calculation.result).toBe(result);
  });

  it('is outdated only under another methodology', () => {
    expect(SimulationCalculation.isOutdated(METHODOLOGY_VERSION)).toBe(false);
    expect(SimulationCalculation.isOutdated('cdb-252-v0')).toBe(true);
  });
});
