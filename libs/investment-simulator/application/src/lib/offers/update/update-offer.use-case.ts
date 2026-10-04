import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferRepository } from '../offer.repository';
import { UpdateOfferCommand } from './update-offer.command';

export class UpdateOfferUseCase
  implements CommandHandler<UpdateOfferCommand, void>
{
  constructor(private readonly offerRepository: OfferRepository) {}

  async execute(command: UpdateOfferCommand): Promise<Result<void, AppError>> {
    const offerResult = await this.offerRepository.findById(command.offerId);
    if (offerResult.isErr()) return offerResult;

    const offer = offerResult.value;

    if (command.maturityDate !== undefined) {
      const result = offer.updateMaturityDate(command.maturityDate);
      if (result.isErr()) return result;
    }
    if (command.redemptionTerms !== undefined) {
      const result = offer.updateRedemptionTerms(command.redemptionTerms);
      if (result.isErr()) return result;
    }
    if (command.remunerationTerms !== undefined) {
      const result = offer.updateRemunerationTerms(command.remunerationTerms);
      if (result.isErr()) return result;
    }

    return this.offerRepository.save(offer);
  }
}
