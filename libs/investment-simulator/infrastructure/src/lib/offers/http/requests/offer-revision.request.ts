import { IsInt, Min } from 'class-validator';
import { OfferRevisionCommandInput } from '@investflow/investment-simulator-application';

export class OfferRevisionRequest implements OfferRevisionCommandInput {
  @IsInt()
  @Min(1)
  revision!: number;
}
