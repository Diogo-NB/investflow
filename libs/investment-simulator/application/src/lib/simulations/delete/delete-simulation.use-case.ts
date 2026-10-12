import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { DeleteSimulationCommand } from './delete-simulation.command';

@Injectable()
export class DeleteSimulationUseCase
  implements CommandHandler<DeleteSimulationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: DeleteSimulationCommand,
  ): Promise<Result<void, AppError>> {
    const simulation = await this.simulationRepository.findOwned(
      command.simulationId,
      command.ownerId,
    );
    if (simulation.isErr()) return simulation;

    return this.simulationRepository.save(
      simulation.value.delete(this.clock.now()),
    );
  }
}
