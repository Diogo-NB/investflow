import { Injectable } from '@nestjs/common';
import {
  ESimulationCalculationStatus,
  Simulation,
  SimulationCalculationPremises,
  SimulationCalculationService,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, NotFoundError, Result } from '@investflow/shared-domain';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { FailSimulationCalculationCommand } from './fail-simulation-calculation.command';

// Runs once the queue gave up on a calculation. A failure already recorded
// stands, and so does an outcome recorded for the current premises: a newer
// request may have succeeded while this one was retried. Anything else waits
// for an outcome that will not come, also a result made stale by an offer or
// curve change.
@Injectable()
export class FailSimulationCalculationUseCase
  implements CommandHandler<FailSimulationCalculationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
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
    if (simulation.calculation.status === ESimulationCalculationStatus.FAILED) {
      return Result.ok(undefined);
    }

    const premises = await this.premises(simulation);
    if (premises.isErr() && !(premises.error instanceof NotFoundError)) {
      return premises;
    }
    if (
      SimulationCalculationService.isCurrent(simulation, premises.valueOrNull)
    ) {
      return Result.ok(undefined);
    }

    const saved = await this.simulationRepository.save(
      simulation.markCalculationFailed(this.clock.now()),
    );
    return saved.isErr() &&
      saved.error instanceof SimulationCalculationStaleError
      ? Result.ok(undefined)
      : saved;
  }

  private async premises(
    simulation: Simulation,
  ): Promise<Result<SimulationCalculationPremises, AppError>> {
    const offer = await this.offerRepository.findById(simulation.offerId);
    if (offer.isErr()) return offer;
    const { curveId } = simulation.investment;
    if (!curveId) return Result.ok({ offer: offer.value, curve: null });
    const curve = await this.curveRepository.findById(curveId);
    return curve.map((value) => ({ offer: offer.value, curve: value }));
  }
}
