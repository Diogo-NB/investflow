import {
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate } from '@investflow/shared-domain';
import {
  OfferIdCommandInput,
  UpdateOfferCommandInput,
} from '../shared/offer-command-input.type';

interface UpdateOfferCommandProps {
  readonly offerId: string;
  readonly maturityDate?: CalendarDate;
  readonly redemptionTerms?: RedemptionTerms;
  readonly remunerationTerms?: RemunerationTerms;
}

export class UpdateOfferCommand {
  readonly offerId: string;
  readonly maturityDate?: CalendarDate;
  readonly redemptionTerms?: RedemptionTerms;
  readonly remunerationTerms?: RemunerationTerms;

  private constructor(props: UpdateOfferCommandProps) {
    this.offerId = props.offerId;
    this.maturityDate = props.maturityDate;
    this.redemptionTerms = props.redemptionTerms;
    this.remunerationTerms = props.remunerationTerms;
  }

  static fromRequest(
    params: OfferIdCommandInput,
    request: UpdateOfferCommandInput,
  ): UpdateOfferCommand {
    return new UpdateOfferCommand({
      offerId: params.offerId,
      ...(request.maturityDate === undefined
        ? {}
        : { maturityDate: CalendarDate.of(request.maturityDate) }),
      ...(request.redemptionTerms === undefined
        ? {}
        : {
            redemptionTerms: RedemptionTerms.create(
              request.redemptionTerms.kind,
            ),
          }),
      ...(request.remunerationTerms === undefined
        ? {}
        : {
            remunerationTerms: RemunerationTerms.create(
              request.remunerationTerms.kind,
              Rate.of(request.remunerationTerms.rate),
            ),
          }),
    });
  }
}
