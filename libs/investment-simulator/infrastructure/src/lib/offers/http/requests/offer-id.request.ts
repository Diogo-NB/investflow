import { OfferIdCommandInput } from '@investflow/investment-simulator-application';
import { IsUUID } from 'class-validator';

export class OfferIdRequest implements OfferIdCommandInput {
  @IsUUID()
  offerId!: string;
}
