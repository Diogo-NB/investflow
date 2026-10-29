import { Injectable } from '@nestjs/common';
import { Curve, Offer } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';

export interface SimulationPremises {
  readonly offer: Offer;
  readonly curve: Curve | null;
}

// Premises the owner cannot see are reported as missing, like deleted ones.
@Injectable()
export class SimulationPremisesService {
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
  ) {}

  async resolve(
    ownerId: string,
    offerId: string,
    curveId: string | null,
  ): Promise<Result<SimulationPremises, AppError>> {
    const offer = await this.offerRepository.findById(offerId);
    if (offer.isErr()) return offer;
    if (!offer.value.isVisibleTo(ownerId)) {
      return Result.err(new OfferNotFoundError(offer.value.id));
    }

    const curve = curveId
      ? await this.curveRepository.findById(curveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;
    if (curve.value && !curve.value.isVisibleTo(ownerId)) {
      return Result.err(new CurveNotFoundError(curve.value.id));
    }
    return Result.ok({ offer: offer.value, curve: curve.value });
  }
}
