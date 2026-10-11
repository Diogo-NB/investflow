import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../offer-not-found.error';
import { OfferRepository } from '../offer.repository';
import { DuplicateOfferCommand } from './duplicate-offer.command';

export interface DuplicateOfferOutput {
  readonly offerId: string;
}

@Injectable()
export class DuplicateOfferUseCase
  implements CommandHandler<DuplicateOfferCommand, DuplicateOfferOutput>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: DuplicateOfferCommand,
  ): Promise<Result<DuplicateOfferOutput, AppError>> {
    const source = await this.offerRepository.findById(command.offerId);
    if (source.isErr()) return source;
    if (!source.value.isVisibleTo(command.actorId)) {
      return Result.err(new OfferNotFoundError(source.value.id));
    }

    const copy = source.value.duplicateFor(command.actorId, this.clock.now());
    if (copy.isErr()) return copy;
    const saved = await this.offerRepository.save(copy.value);
    return saved.map(() => ({ offerId: copy.value.id }));
  }
}
