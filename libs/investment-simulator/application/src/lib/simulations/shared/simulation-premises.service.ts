import { Injectable } from '@nestjs/common';
import {
  Curve,
  EOfferScope,
  Offer,
} from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationRepository } from '../simulation.repository';

export interface SimulationPremises {
  readonly offer: Offer;
  readonly curve: Curve | null;
}

// Premises the owner cannot use are reported as missing, like deleted ones.
@Injectable()
export class SimulationPremisesService {
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
    private readonly simulationRepository: SimulationRepository,
  ) {}

  /** simulationId is the simulation being edited; null while creating one. */
  async resolve(
    ownerId: string,
    offerId: string,
    curveId: string | null,
    simulationId: string | null,
  ): Promise<Result<SimulationPremises, AppError>> {
    const offer = await this.offerRepository.findById(offerId);
    if (offer.isErr()) return offer;
    if (!offer.value.isVisibleTo(ownerId)) {
      return Result.err(new OfferNotFoundError(offer.value.id));
    }
    const usable = await this.checkOfferUse(offer.value, simulationId);
    if (usable.isErr()) return usable;

    const curve = curveId
      ? await this.curveRepository.findById(curveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;
    if (curve.value && !curve.value.isVisibleTo(ownerId)) {
      return Result.err(new CurveNotFoundError(curve.value.id));
    }
    return Result.ok({ offer: offer.value, curve: curve.value });
  }

  // A simulation's own terms belong to it alone. Two concurrent requests could
  // both pass; the screen never makes them, and only on the caller's own
  // offer, so no lock guards it.
  private async checkOfferUse(
    offer: Offer,
    simulationId: string | null,
  ): Promise<Result<void, AppError>> {
    if (offer.scope !== EOfferScope.SIMULATION) return Result.ok(undefined);
    const users = await this.simulationRepository.findIdsByOffer(offer.id);
    if (users.isErr()) return users;
    return users.value.some((id) => id !== simulationId)
      ? Result.err(new OfferNotFoundError(offer.id))
      : Result.ok(undefined);
  }
}
