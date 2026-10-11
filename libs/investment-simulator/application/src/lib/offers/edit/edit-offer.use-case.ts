import { Injectable } from '@nestjs/common';
import { OfferReadOnlyError } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { EditOfferCommand } from './edit-offer.command';

@Injectable()
export class EditOfferUseCase
  implements CommandHandler<EditOfferCommand, void>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: EditOfferCommand): Promise<Result<void, AppError>> {
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

    const edited = offer.edit(
      {
        name: command.name,
        issuerName: command.issuerName,
        maturityDate: command.maturityDate,
        redemptionTerms: command.redemptionTerms,
        remunerationTerms: command.remunerationTerms,
      },
      this.clock.now(),
    );
    if (edited.isErr()) return edited;
    return this.offerRepository.save(offer);
  }
}
