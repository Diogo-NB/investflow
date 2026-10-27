import { Injectable } from '@nestjs/common';
import { SimulationCalculationRequested } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import {
  AppError,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { RecalculateCurveSimulationsCommand } from './recalculate-curve-simulations.command';

// Runs when a curve's values changed or it was deleted. Requests one calculation
// per simulation using it without loading them or marking them pending; each
// calculation reads the current curve, and finds it missing after a deletion.
@Injectable()
export class RecalculateCurveSimulationsUseCase
  implements CommandHandler<RecalculateCurveSimulationsCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly events: DomainEventRecorder,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RecalculateCurveSimulationsCommand,
  ): Promise<Result<void, AppError>> {
    const ids = await this.simulationRepository.idsUsingCurve(command.curveId);
    if (ids.isErr()) return ids;
    const now = this.clock.now();
    this.events.record(
      ...ids.value.map((id) => new SimulationCalculationRequested(id, now)),
    );
    return Result.ok(undefined);
  }
}
