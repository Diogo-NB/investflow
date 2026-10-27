import { IsUUID } from 'class-validator';
import { InvestmentPlanSimulationIdCommandInput } from '@investflow/investment-simulator-application';

export class InvestmentPlanSimulationIdRequest
  implements InvestmentPlanSimulationIdCommandInput
{
  @IsUUID()
  investmentPlanId!: string;

  @IsUUID()
  simulationId!: string;
}
