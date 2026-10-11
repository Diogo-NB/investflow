import { OfferIdCommandInput } from '../shared/offer-command-input.type';

export class DuplicateOfferCommand {
  private constructor(
    readonly actorId: string | null,
    readonly offerId: string,
  ) {}

  static fromRequest(
    actorId: string | null,
    params: OfferIdCommandInput,
  ): DuplicateOfferCommand {
    return new DuplicateOfferCommand(actorId, params.offerId);
  }
}
