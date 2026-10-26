import { Injectable } from '@nestjs/common';
import {
  Curve,
  Offer,
  Simulation,
  SimulationCalculationOutcome,
  SimulationCalculationService,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import {
  AppError,
  NotFoundError,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { CalculateSimulationCommand } from './calculate-simulation.command';

// Runs for a queued calculation. Work that is no longer needed (a deleted
// simulation, a newer change, an outcome already recorded for the current
// premises) succeeds without effect so the message is acknowledged; any
// returned error is retried by the queue.
@Injectable()
export class CalculateSimulationUseCase
  implements CommandHandler<CalculateSimulationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
    private readonly calculation: SimulationCalculationService,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CalculateSimulationCommand,
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

    const premises = await this.premises(simulation);
    if (premises.isErr()) {
      return premises.error instanceof NotFoundError
        ? this.recordMissing(simulation, premises.error)
        : premises;
    }
    const { offer, curve } = premises.value;
    if (this.calculation.isCurrent(simulation, offer, curve)) {
      return Result.ok(undefined);
    }
    const now = this.clock.now();
    return this.record(
      simulation,
      this.calculation.calculate(simulation, offer, curve, now),
      now,
    );
  }

  // A deleted offer or curve makes the calculation INVALID, which no retry
  // fixes.
  private async recordMissing(
    simulation: Simulation,
    missing: NotFoundError,
  ): Promise<Result<void, AppError>> {
    const inputs = {
      simulationRevision: simulation.revision,
      offerTermsRevision: null,
      curveValuesRevision: null,
    };
    if (simulation.calculation.appliesTo(inputs)) return Result.ok(undefined);
    return this.record(
      simulation,
      { kind: 'INVALID', inputs, reason: missing },
      this.clock.now(),
    );
  }

  private async record(
    simulation: Simulation,
    outcome: SimulationCalculationOutcome,
    at: UtcInstant,
  ): Promise<Result<void, AppError>> {
    const recorded = simulation.recordCalculation(outcome, at);
    if (recorded.isErr()) return Result.ok(undefined);
    const saved = await this.simulationRepository.save(simulation);
    return saved.isErr() &&
      saved.error instanceof SimulationCalculationStaleError
      ? Result.ok(undefined)
      : saved;
  }

  private async premises(
    simulation: Simulation,
  ): Promise<Result<{ offer: Offer; curve: Curve | null }, AppError>> {
    const offer = await this.offerRepository.findById(simulation.offerId);
    if (offer.isErr()) return offer;
    const { curveId } = simulation.investment;
    if (!curveId) return Result.ok({ offer: offer.value, curve: null });
    const curve = await this.curveRepository.findById(curveId);
    return curve.map((value) => ({ offer: offer.value, curve: value }));
  }
}
