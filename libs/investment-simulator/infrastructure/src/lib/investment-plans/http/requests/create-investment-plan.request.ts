import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateInvestmentPlanCommandInput } from '@investflow/investment-simulator-application';

export class CreateInvestmentPlanRequest
  implements CreateInvestmentPlanCommandInput
{
  @IsString()
  @MaxLength(100)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
