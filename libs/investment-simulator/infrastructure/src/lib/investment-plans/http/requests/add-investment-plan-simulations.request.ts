import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { AddInvestmentPlanSimulationsCommandInput } from '@investflow/investment-simulator-application';
import { InvestmentPlan } from '@investflow/investment-simulator-domain';

export class AddInvestmentPlanSimulationsRequest
  implements AddInvestmentPlanSimulationsCommandInput
{
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(InvestmentPlan.SIMULATION_LIMIT)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  simulationIds!: string[];
}
