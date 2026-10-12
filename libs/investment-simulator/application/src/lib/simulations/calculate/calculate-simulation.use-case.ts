import { Injectable } from '@nestjs/common';
import {
  Curve,
  Offer,
  SimulationCalculationOutcome,
  SimulationCalculationService,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { CalculateSimulationCommand } from './calculate-simulation.command';

type Premises =
  | { readonly offer: Offer; readonly curve: Curve | null }
  | { readonly missing: OfferNotFoundError | CurveNotFoundError };

// Runs for a queued calculation. Work that is no longer needed (a deleted
// simulation, a newer change) succeeds without effect so the message is
// acknowledged; any returned error is retried by the queue.
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

    const premises = await this.premises(
      simulation.offerId,
      simulation.investment.curveId,
    );
    if (premises.isErr()) return premises;

    const now = this.clock.now();
    const outcome: SimulationCalculationOutcome =
      'missing' in premises.value
        ? {
            kind: 'INVALID',
            inputs: {
              simulationRevision: simulation.revision,
              offerRevision: null,
              curveRevision: null,
            },
            reason: premises.value.missing,
          }
        : this.calculation.calculate(
            simulation,
            premises.value.offer,
            premises.value.curve,
            now,
          );

    const recorded = simulation.recordCalculation(outcome, now);
    if (recorded.isErr()) return Result.ok(undefined);
    const saved = await this.simulationRepository.save(simulation);
    return saved.isErr() &&
      saved.error instanceof SimulationCalculationStaleError
      ? Result.ok(undefined)
      : saved;
  }

  // A deleted offer or curve is reported as missing, which no retry fixes.
  private async premises(
    offerId: string,
    curveId: string | null,
  ): Promise<Result<Premises, AppError>> {
    const offer = await this.offerRepository.findById(offerId);
    if (offer.isErr()) {
      return offer.error instanceof OfferNotFoundError
        ? Result.ok({ missing: offer.error })
        : offer;
    }
    if (!curveId) return Result.ok({ offer: offer.value, curve: null });
    const curve = await this.curveRepository.findById(curveId);
    if (curve.isErr()) {
      return curve.error instanceof CurveNotFoundError
        ? Result.ok({ missing: curve.error })
        : curve;
    }
    return Result.ok({ offer: offer.value, curve: curve.value });
  }
}
