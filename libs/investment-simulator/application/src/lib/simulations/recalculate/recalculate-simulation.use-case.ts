import { Injectable } from '@nestjs/common';
import { ESimulationCalculationCauseKind } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { RecalculateSimulationCommand } from './recalculate-simulation.command';

@Injectable()
export class RecalculateSimulationUseCase
  implements CommandHandler<RecalculateSimulationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RecalculateSimulationCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.simulationRepository.findOwned(
      command.simulationId,
      command.ownerId,
    );
    if (found.isErr()) return found;

    const requested = found.value.requestCalculation(
      {
        kind: ESimulationCalculationCauseKind.RETRY_REQUESTED,
        refId: null,
        actorId: command.ownerId,
      },
      this.clock.now(),
    );
    if (requested.isErr()) return requested;
    return this.simulationRepository.save(requested.value);
  }
}
