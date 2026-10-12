import { IsInt, Min } from 'class-validator';
import { EditSimulationCommandInput } from '@investflow/investment-simulator-application';
import { CreateSimulationRequest } from './create-simulation.request';

export class EditSimulationRequest
  extends CreateSimulationRequest
  implements EditSimulationCommandInput
{
  @IsInt()
  @Min(1)
  revision!: number;
}
