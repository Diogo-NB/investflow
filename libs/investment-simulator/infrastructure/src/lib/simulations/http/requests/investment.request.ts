import { IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { InvestmentCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';

export class InvestmentRequest implements InvestmentCommandInput {
  @IsNumberString({ no_symbols: false })
  principal!: string;

  @IsCalendarDate()
  investmentDate!: string;

  @IsOptional()
  @IsUUID()
  indexCurveId?: string | null;
}
