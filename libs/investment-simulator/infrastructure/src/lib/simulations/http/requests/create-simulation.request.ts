import { Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CreateSimulationCommandInput,
  SimulationOfferCommandInput,
} from '@investflow/investment-simulator-application';
import { CreateOfferRequest } from '../../../offers/http/requests/create-offer.request';
import { InvestmentRequest } from './investment.request';

// Either a visible offer or the terms of a new private offer. When both are
// sent, the new offer is validated and used.
export class SimulationOfferRequest implements SimulationOfferCommandInput {
  @ValidateIf((offer: SimulationOfferRequest) => offer.new === undefined)
  @IsUUID()
  id?: string;

  @ValidateIf(
    (offer: SimulationOfferRequest) =>
      offer.id === undefined || offer.new !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => CreateOfferRequest)
  new?: CreateOfferRequest;
}

export class CreateSimulationRequest implements CreateSimulationCommandInput {
  @IsDefined()
  @ValidateNested()
  @Type(() => SimulationOfferRequest)
  offer!: SimulationOfferRequest;

  @IsDefined()
  @ValidateNested()
  @Type(() => InvestmentRequest)
  investment!: InvestmentRequest;
}
