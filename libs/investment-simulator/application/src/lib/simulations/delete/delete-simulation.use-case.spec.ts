import { Clock } from '@investflow/shared-application';
import { Result, UtcInstant } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { ownedSimulation, OWNER_ID } from '../shared/simulation-fixture';
import { DeleteSimulationCommand } from './delete-simulation.command';
import { DeleteSimulationUseCase } from './delete-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const simulation = ownedSimulation();
  const simulations = {
    findOwned: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  return {
    simulation,
    simulations,
    useCase: new DeleteSimulationUseCase(simulations, clock),
  };
}

describe('DeleteSimulationUseCase', () => {
  it('soft deletes an owned simulation', async () => {
    const { simulation, simulations, useCase } = setup();

    const result = await useCase.execute(
      DeleteSimulationCommand.fromRequest(OWNER_ID, {
        simulationId: simulation.id,
      }),
    );

    expect(result.isOk()).toBe(true);
    expect(simulation.deletedAt).toBe(NOW);
    expect(simulations.save).toHaveBeenCalledWith(simulation);
  });

  it("looks up the requester's simulation and stops when it is missing", async () => {
    const { simulation, simulations, useCase } = setup();
    const error = new SimulationNotFoundError(simulation.id);
    simulations.findOwned.mockResolvedValue(Result.err(error));

    const result = await useCase.execute(
      DeleteSimulationCommand.fromRequest('someone-else', {
        simulationId: simulation.id,
      }),
    );

    expect(simulations.findOwned).toHaveBeenCalledWith(
      simulation.id,
      'someone-else',
    );
    expect(result.error).toBe(error);
    expect(simulations.save).not.toHaveBeenCalled();
  });
});
