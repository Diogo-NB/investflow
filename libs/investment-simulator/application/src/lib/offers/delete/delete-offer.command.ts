import { OfferIdCommandInput } from '../shared/offer-command-input.type';

export class DeleteOfferCommand {
  private constructor(
    readonly actorId: string | null,
    readonly offerId: string,
  ) {}

  static fromRequest(
    actorId: string | null,
    params: OfferIdCommandInput,
  ): DeleteOfferCommand {
    return new DeleteOfferCommand(actorId, params.offerId);
  }
}
