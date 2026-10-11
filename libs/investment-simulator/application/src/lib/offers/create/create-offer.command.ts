import {
  RedemptionTerms,
  RemunerationTerms,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate } from '@investflow/shared-domain';
import { CreateOfferCommandInput } from '../shared/offer-command-input.type';

export class CreateOfferCommand {
  private constructor(
    readonly titleType: ETitleType,
    readonly issuerId: string | null,
    readonly maturityDate: CalendarDate,
    readonly redemptionTerms: RedemptionTerms,
    readonly remunerationTerms: RemunerationTerms,
  ) {}

  static fromRequest(request: CreateOfferCommandInput): CreateOfferCommand {
    return new CreateOfferCommand(
      request.titleType,
      request.issuerId ?? null,
      CalendarDate.of(request.maturityDate),
      RedemptionTerms.create(request.redemptionTerms.kind),
      RemunerationTerms.create(
        request.remunerationTerms.kind,
        Rate.of(request.remunerationTerms.rate),
      ),
    );
  }
}
