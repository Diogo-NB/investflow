import { Injectable } from '@nestjs/common';
import { OfferReadOnlyError } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { MoveOfferToCatalogCommand } from './move-offer-to-catalog.command';

// A simulation's own terms become an offer in Ofertas; the simulation keeps
// using it, now as a catalog offer.
@Injectable()
export class MoveOfferToCatalogUseCase
  implements CommandHandler<MoveOfferToCatalogCommand, void>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: MoveOfferToCatalogCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.offerRepository.findById(command.offerId);
    if (found.isErr()) return found;
    const offer = found.value;
    if (!offer.isVisibleTo(command.actorId)) {
      return Result.err(new OfferNotFoundError(offer.id));
    }
    if (!offer.canBeChangedBy(command.actorId)) {
      return Result.err(new OfferReadOnlyError(offer.id));
    }
    const current = offer.assertRevision(command.revision);
    if (current.isErr()) return current;

    offer.moveToCatalog(this.clock.now());
    return this.offerRepository.save(offer);
  }
}
