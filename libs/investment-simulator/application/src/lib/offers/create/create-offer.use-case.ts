import { Injectable } from '@nestjs/common';
import { Offer } from '@investflow/investment-simulator-domain';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferRepository } from '../offer.repository';
import { CreateOfferCommand } from './create-offer.command';

export interface CreateOfferOutput {
  readonly id: string;
}

@Injectable()
export class CreateOfferUseCase
  implements CommandHandler<CreateOfferCommand, CreateOfferOutput>
{
  constructor(private readonly offerRepository: OfferRepository) {}

  async execute(
    command: CreateOfferCommand,
  ): Promise<Result<CreateOfferOutput, AppError>> {
    const offer = Offer.create(command);
    const saveResult = await this.offerRepository.save(offer);
    return saveResult.map(() => ({ id: offer.id }));
  }
}
