import { OfferIdCommandInput } from '../shared/offer-command-input.type';

export class DeleteOfferCommand {
  private constructor(readonly offerId: string) {}

  static fromRequest(request: OfferIdCommandInput): DeleteOfferCommand {
    return new DeleteOfferCommand(request.offerId);
  }
}
