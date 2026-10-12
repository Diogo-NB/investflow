import { Injectable } from '@nestjs/common';
import { Curve, Offer } from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationOfferChoice } from '../create/create-simulation.command';

export interface SimulationPremises {
  readonly offer: Offer;
  // Not saved yet: it is saved only with the simulation that uses it.
  readonly offerIsNew: boolean;
  readonly curve: Curve | null;
}

// Premises the owner cannot see are reported as missing, like deleted ones.
@Injectable()
export class SimulationPremisesService {
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
    private readonly clock: Clock,
  ) {}

  async resolve(
    ownerId: string,
    choice: SimulationOfferChoice,
    curveId: string | null,
  ): Promise<Result<SimulationPremises, AppError>> {
    const offer = await this.resolveOffer(ownerId, choice);
    if (offer.isErr()) return offer;

    const curve = curveId
      ? await this.curveRepository.findById(curveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;
    if (curve.value && !curve.value.isVisibleTo(ownerId)) {
      return Result.err(new CurveNotFoundError(curve.value.id));
    }
    return Result.ok({
      offer: offer.value,
      offerIsNew: choice.kind === 'new',
      curve: curve.value,
    });
  }

  async saveNewOffer(
    premises: SimulationPremises,
  ): Promise<Result<void, AppError>> {
    return premises.offerIsNew
      ? this.offerRepository.save(premises.offer)
      : Result.ok(undefined);
  }

  private async resolveOffer(
    ownerId: string,
    choice: SimulationOfferChoice,
  ): Promise<Result<Offer, AppError>> {
    if (choice.kind === 'new') {
      const { offer } = choice;
      return Offer.create(
        {
          ownerId: offer.actorId,
          titleType: offer.titleType,
          name: offer.name,
          issuerName: offer.issuerName,
          maturityDate: offer.maturityDate,
          redemptionTerms: offer.redemptionTerms,
          remunerationTerms: offer.remunerationTerms,
        },
        this.clock.now(),
      );
    }
    const found = await this.offerRepository.findById(choice.offerId);
    if (found.isErr()) return found;
    if (!found.value.isVisibleTo(ownerId)) {
      return Result.err(new OfferNotFoundError(found.value.id));
    }
    return found;
  }
}
