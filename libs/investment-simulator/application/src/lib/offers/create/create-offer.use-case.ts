import { Injectable } from '@nestjs/common';
import { Offer } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferRepository } from '../offer.repository';
import { CreateOfferCommand } from './create-offer.command';

export interface CreateOfferOutput {
  readonly offerId: string;
}

@Injectable()
export class CreateOfferUseCase
  implements CommandHandler<CreateOfferCommand, CreateOfferOutput>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CreateOfferCommand,
  ): Promise<Result<CreateOfferOutput, AppError>> {
    const offer = Offer.create(
      {
        ownerId: command.actorId,
        titleType: command.titleType,
        name: command.name,
        issuerName: command.issuerName,
        maturityDate: command.maturityDate,
        redemptionTerms: command.redemptionTerms,
        remunerationTerms: command.remunerationTerms,
      },
      this.clock.now(),
    );
    if (offer.isErr()) return offer;

    const saved = await this.offerRepository.save(offer.value);
    return saved.map(() => ({ offerId: offer.value.id }));
  }
}
