import { CommandHandler, Clock } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferRepository } from '../offer.repository';
import { DeleteOfferCommand } from './delete-offer.command';

export class DeleteOfferUseCase
  implements CommandHandler<DeleteOfferCommand, void>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: DeleteOfferCommand): Promise<Result<void, AppError>> {
    const offerResult = await this.offerRepository.findById(command.offerId);
    if (offerResult.isErr()) return offerResult;

    const offer = offerResult.value.softDelete(this.clock.now());
    return this.offerRepository.save(offer);
  }
}
