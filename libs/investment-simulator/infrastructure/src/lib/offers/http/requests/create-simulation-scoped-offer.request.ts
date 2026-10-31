import { IsOptional, IsUUID } from 'class-validator';
import { CreateSimulationScopedOfferCommandInput } from '@investflow/investment-simulator-application';
import { CreateOfferRequest } from './create-offer.request';

export class CreateSimulationScopedOfferRequest
  extends CreateOfferRequest
  implements CreateSimulationScopedOfferCommandInput
{
  @IsOptional()
  @IsUUID()
  basedOnOfferId?: string | null;
}
