import { IsOptional, IsUUID } from 'class-validator';
import { CreateSimulationCommandInput } from '@investflow/investment-simulator-application';
import { SimulationInputsRequest } from './simulation-inputs.request';

export class CreateSimulationRequest
  extends SimulationInputsRequest
  implements CreateSimulationCommandInput
{
  @IsOptional()
  @IsUUID()
  offerId?: string;
}
