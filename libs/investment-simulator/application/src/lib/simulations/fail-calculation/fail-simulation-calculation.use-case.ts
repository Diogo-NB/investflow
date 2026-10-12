import { Injectable } from '@nestjs/common';
import { SimulationCalculationStaleError } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { FailSimulationCalculationCommand } from './fail-simulation-calculation.command';

// Runs once the queue gave up on a calculation. A simulation changed since is
// waiting for a newer calculation and is left alone.
@Injectable()
export class FailSimulationCalculationUseCase
  implements CommandHandler<FailSimulationCalculationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: FailSimulationCalculationCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.simulationRepository.findById(
      command.simulationId,
    );
    if (found.isErr()) {
      return found.error instanceof SimulationNotFoundError
        ? Result.ok(undefined)
        : found;
    }
    const simulation = found.value;
    if (!simulation.calculation.isPending) return Result.ok(undefined);

    const saved = await this.simulationRepository.save(
      simulation.markCalculationFailed(this.clock.now()),
    );
    return saved.isErr() &&
      saved.error instanceof SimulationCalculationStaleError
      ? Result.ok(undefined)
      : saved;
  }
}
