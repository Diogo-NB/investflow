import {
  RedemptionTerms,
  RemunerationTerms,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate } from '@investflow/shared-domain';
import {
  CreateOfferCommandInput,
  RemunerationTermsCommandInput,
} from '../shared/offer-command-input.type';

export class CreateOfferCommand {
  private constructor(
    // Null is the system, used by seed and import processes.
    readonly actorId: string | null,
    readonly titleType: ETitleType,
    readonly name: string | null,
    readonly issuerName: string | null,
    readonly maturityDate: CalendarDate,
    readonly redemptionTerms: RedemptionTerms,
    readonly remunerationTerms: RemunerationTerms,
  ) {}

  static fromRequest(
    actorId: string | null,
    request: CreateOfferCommandInput,
  ): CreateOfferCommand {
    return new CreateOfferCommand(
      actorId,
      request.titleType,
      request.name ?? null,
      request.issuerName ?? null,
      CalendarDate.of(request.maturityDate),
      RedemptionTerms.create(request.redemptionTerms.kind),
      CreateOfferCommand.toRemuneration(request.remunerationTerms),
    );
  }

  static toRemuneration(
    terms: RemunerationTermsCommandInput,
  ): RemunerationTerms {
    return RemunerationTerms.create(terms.kind, Rate.of(terms.rate));
  }
}
