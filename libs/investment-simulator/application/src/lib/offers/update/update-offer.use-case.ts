import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferRepository } from '../offer.repository';
import { UpdateOfferCommand } from './update-offer.command';

@Injectable()
export class UpdateOfferUseCase
  implements CommandHandler<UpdateOfferCommand, void>
{
  constructor(private readonly offerRepository: OfferRepository) {}

  async execute(command: UpdateOfferCommand): Promise<Result<void, AppError>> {
    const offerResult = await this.offerRepository.findById(command.offerId);
    if (offerResult.isErr()) return offerResult;

    const offer = offerResult.value;

    if (command.maturityDate !== undefined) {
      offer.updateMaturityDate(command.maturityDate);
    }
    if (command.redemptionTerms !== undefined) {
      offer.updateRedemptionTerms(command.redemptionTerms);
    }
    if (command.remunerationTerms !== undefined) {
      offer.updateRemunerationTerms(command.remunerationTerms);
    }

    return this.offerRepository.save(offer);
  }
}
