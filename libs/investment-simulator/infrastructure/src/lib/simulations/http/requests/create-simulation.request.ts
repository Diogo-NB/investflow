import { Type } from 'class-transformer';
import { IsDefined, IsUUID, ValidateNested } from 'class-validator';
import { CreateSimulationCommandInput } from '@investflow/investment-simulator-application';
import { InvestmentRequest } from './investment.request';

export class CreateSimulationRequest implements CreateSimulationCommandInput {
  @IsUUID()
  offerId!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => InvestmentRequest)
  investment!: InvestmentRequest;
}
