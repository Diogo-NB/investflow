import {
  ESimulationCalculationStatus,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { Result, UtcInstant } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { ownedSimulation } from '../shared/simulation-fixture';
import { FailSimulationCalculationCommand } from './fail-simulation-calculation.command';
import { FailSimulationCalculationUseCase } from './fail-simulation-calculation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const simulation = ownedSimulation();
  const simulations = {
    findById: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const useCase = new FailSimulationCalculationUseCase(simulations, {
    now: () => NOW,
  } as unknown as Clock);
  const execute = () =>
    useCase.execute(FailSimulationCalculationCommand.of(simulation.id));
  return { simulation, simulations, execute };
}

describe('FailSimulationCalculationUseCase', () => {
  it('marks a pending calculation as failed', async () => {
    const { simulation, simulations, execute } = setup();

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.FAILED,
    );
    expect(simulation.calculation.changedAt).toBe(NOW);
    expect(simulations.save).toHaveBeenCalledWith(simulation);
  });

  it('leaves a calculation that already has an outcome', async () => {
    const { simulation, simulations, execute } = setup();
    simulation.markCalculationFailed(NOW);
    simulations.save.mockClear();

    expect((await execute()).isOk()).toBe(true);
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('acknowledges a deleted simulation or a newer change', async () => {
    const { simulations, execute } = setup();
    simulations.save.mockResolvedValue(
      Result.err(new SimulationCalculationStaleError('simulation-id', 1)),
    );
    expect((await execute()).isOk()).toBe(true);

    simulations.findById.mockResolvedValue(
      Result.err(new SimulationNotFoundError('simulation-id')),
    );
    expect((await execute()).isOk()).toBe(true);
  });
});
