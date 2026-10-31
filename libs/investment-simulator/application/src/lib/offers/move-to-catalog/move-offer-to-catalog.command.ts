import { OfferRevisionCommandInput } from '../shared/offer-command-input.type';

export class MoveOfferToCatalogCommand {
  private constructor(
    readonly actorId: string,
    readonly offerId: string,
    readonly revision: number,
  ) {}

  static fromRequest(
    actorId: string,
    offerId: string,
    request: OfferRevisionCommandInput,
  ): MoveOfferToCatalogCommand {
    return new MoveOfferToCatalogCommand(actorId, offerId, request.revision);
  }
}
