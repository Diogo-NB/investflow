import { Offer } from '@investflow/investment-simulator-domain';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { IssuerRepository } from '../../issuers/issuer.repository';
import { OfferRepository } from '../offer.repository';
import { CreateOfferCommand } from './create-offer.command';

export interface CreateOfferOutput {
  readonly id: string;
}

export class CreateOfferUseCase
  implements CommandHandler<CreateOfferCommand, CreateOfferOutput>
{
  constructor(
    private readonly issuerRepository: IssuerRepository,
    private readonly offerRepository: OfferRepository,
  ) {}

  async execute(
    command: CreateOfferCommand,
  ): Promise<Result<CreateOfferOutput, AppError>> {
    const issuerResult = await this.issuerRepository.findById(command.issuerId);
    if (issuerResult.isErr()) return issuerResult;

    const offer = Offer.create(command);
    const saveResult = await this.offerRepository.save(offer);
    return saveResult.map(() => ({ id: offer.id }));
  }
}
