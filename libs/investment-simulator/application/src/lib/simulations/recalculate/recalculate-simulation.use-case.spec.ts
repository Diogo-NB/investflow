import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { EAppErrorCode, Result, UtcInstant } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { ownedSimulation, OWNER_ID } from '../shared/simulation-fixture';
import { RecalculateSimulationCommand } from './recalculate-simulation.command';
import { RecalculateSimulationUseCase } from './recalculate-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const simulation = ownedSimulation();
  simulation.markCalculationFailed(NOW);
  const simulations = {
    findOwned: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const useCase = new RecalculateSimulationUseCase(simulations, {
    now: () => NOW,
  } as unknown as Clock);
  return { simulation, simulations, useCase };
}

describe('RecalculateSimulationUseCase', () => {
  it('queues the calculation again on behalf of the owner', async () => {
    const { simulation, simulations, useCase } = setup();

    const result = await useCase.execute(
      RecalculateSimulationCommand.fromRequest(OWNER_ID, {
        simulationId: simulation.id,
      }),
    );

    expect(result.isOk()).toBe(true);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual({
      kind: ESimulationCalculationCauseKind.RETRY_REQUESTED,
      actorId: OWNER_ID,
    });
    expect(
      simulation.getDomainEvents().map(({ eventType }) => eventType),
    ).toEqual(['SimulationCalculationRequested']);
    expect(simulations.save).toHaveBeenCalledWith(simulation);
  });

  it("looks up the requester's simulation and stops when it is missing", async () => {
    const { simulation, simulations, useCase } = setup();
    simulations.findOwned.mockResolvedValue(
      Result.err(new SimulationNotFoundError(simulation.id)),
    );

    const result = await useCase.execute(
      RecalculateSimulationCommand.fromRequest('someone-else', {
        simulationId: simulation.id,
      }),
    );

    expect(simulations.findOwned).toHaveBeenCalledWith(
      simulation.id,
      'someone-else',
    );
    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
    expect(simulations.save).not.toHaveBeenCalled();
  });
});
