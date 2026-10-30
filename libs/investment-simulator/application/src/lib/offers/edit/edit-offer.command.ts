import {
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { CreateOfferCommand } from '../create/create-offer.command';
import {
  EditOfferCommandInput,
  OfferIdCommandInput,
} from '../shared/offer-command-input.type';

export class EditOfferCommand {
  private constructor(
    readonly actorId: string | null,
    readonly offerId: string,
    readonly revision: number,
    readonly name?: string | null,
    readonly issuerName?: string | null,
    readonly maturityDate?: CalendarDate,
    readonly redemptionTerms?: RedemptionTerms,
    readonly remunerationTerms?: RemunerationTerms,
  ) {}

  static fromRequest(
    actorId: string | null,
    params: OfferIdCommandInput,
    request: EditOfferCommandInput,
  ): EditOfferCommand {
    return new EditOfferCommand(
      actorId,
      params.offerId,
      request.revision,
      request.name,
      request.issuerName,
      request.maturityDate === undefined
        ? undefined
        : CalendarDate.of(request.maturityDate),
      request.redemptionTerms &&
        RedemptionTerms.create(request.redemptionTerms.kind),
      request.remunerationTerms &&
        CreateOfferCommand.toRemuneration(request.remunerationTerms),
    );
  }
}
