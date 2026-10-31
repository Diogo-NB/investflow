import { Injectable } from '@nestjs/common';
import { EOfferScope, Offer } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { CreateSimulationScopedOfferCommand } from './create-simulation-scoped-offer.command';

export interface CreateSimulationScopedOfferOutput {
  readonly offerId: string;
}

// A simulation's own terms. They are saved before the simulation that uses
// them, so each request changes one aggregate.
@Injectable()
export class CreateSimulationScopedOfferUseCase
  implements
    CommandHandler<
      CreateSimulationScopedOfferCommand,
      CreateSimulationScopedOfferOutput
    >
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CreateSimulationScopedOfferCommand,
  ): Promise<Result<CreateSimulationScopedOfferOutput, AppError>> {
    const base = await this.checkBase(command);
    if (base.isErr()) return base;

    const offer = Offer.createSimulationScoped(
      {
        ownerId: command.actorId,
        titleType: command.titleType,
        name: command.name,
        issuerName: command.issuerName,
        maturityDate: command.maturityDate,
        redemptionTerms: command.redemptionTerms,
        remunerationTerms: command.remunerationTerms,
        basedOnOfferId: command.basedOnOfferId,
      },
      this.clock.now(),
    );
    const saved = await this.offerRepository.save(offer);
    return saved.map(() => ({ offerId: offer.id }));
  }

  // The base is an offer the actor can choose, so it is in the catalog.
  private async checkBase(
    command: CreateSimulationScopedOfferCommand,
  ): Promise<Result<void, AppError>> {
    if (!command.basedOnOfferId) return Result.ok(undefined);
    const base = await this.offerRepository.findById(command.basedOnOfferId);
    if (base.isErr()) return base;
    return base.value.isVisibleTo(command.actorId) &&
      base.value.scope === EOfferScope.CATALOG
      ? Result.ok(undefined)
      : Result.err(new OfferNotFoundError(base.value.id));
  }
}
