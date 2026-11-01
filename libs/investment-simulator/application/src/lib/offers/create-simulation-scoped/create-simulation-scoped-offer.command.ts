import {
  RedemptionTerms,
  RemunerationTerms,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { CreateOfferCommand } from '../create/create-offer.command';
import { CreateSimulationScopedOfferCommandInput } from '../shared/offer-command-input.type';

export class CreateSimulationScopedOfferCommand {
  private constructor(
    readonly actorId: string,
    readonly titleType: ETitleType,
    readonly name: string | null,
    readonly issuerName: string | null,
    readonly maturityDate: CalendarDate,
    readonly redemptionTerms: RedemptionTerms,
    readonly remunerationTerms: RemunerationTerms,
    // The offer the terms came from; null when typed from scratch.
    readonly basedOnOfferId: string | null,
  ) {}

  static fromRequest(
    actorId: string,
    request: CreateSimulationScopedOfferCommandInput,
  ): CreateSimulationScopedOfferCommand {
    return new CreateSimulationScopedOfferCommand(
      actorId,
      request.titleType,
      request.name ?? null,
      request.issuerName ?? null,
      CalendarDate.of(request.maturityDate),
      RedemptionTerms.create(request.redemptionTerms.kind),
      CreateOfferCommand.toRemuneration(request.remunerationTerms),
      request.basedOnOfferId ?? null,
    );
  }
}
