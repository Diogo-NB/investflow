import { IsUUID } from 'class-validator';
import { InvestmentPlanIdCommandInput } from '@investflow/investment-simulator-application';

export class InvestmentPlanIdRequest implements InvestmentPlanIdCommandInput {
  @IsUUID()
  investmentPlanId!: string;
}
