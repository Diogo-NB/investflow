import { Type } from 'class-transformer';
import { IsDefined, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { StartSimulationCommandInput } from '@investflow/investment-simulator-application';
import { InvestmentRequest } from './investment.request';
import { SimulationTermsRequest } from './simulation-terms.request';

export class StartSimulationRequest implements StartSimulationCommandInput {
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => SimulationTermsRequest)
  terms!: SimulationTermsRequest;

  @IsDefined()
  @ValidateNested()
  @Type(() => InvestmentRequest)
  investment!: InvestmentRequest;
}
