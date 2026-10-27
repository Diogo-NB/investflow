import { Injectable } from '@nestjs/common';
import { SimulationCalculationRequested } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import {
  AppError,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { RecalculateOfferSimulationsCommand } from './recalculate-offer-simulations.command';

// Runs when an offer's terms changed or it was deleted. Requests one calculation
// per simulation using it without loading them or marking them pending; each
// calculation reads the current offer, and finds it missing after a deletion.
@Injectable()
export class RecalculateOfferSimulationsUseCase
  implements CommandHandler<RecalculateOfferSimulationsCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly events: DomainEventRecorder,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RecalculateOfferSimulationsCommand,
  ): Promise<Result<void, AppError>> {
    const ids = await this.simulationRepository.idsUsingOffer(command.offerId);
    if (ids.isErr()) return ids;
    const now = this.clock.now();
    this.events.record(
      ...ids.value.map((id) => new SimulationCalculationRequested(id, now)),
    );
    return Result.ok(undefined);
  }
}
