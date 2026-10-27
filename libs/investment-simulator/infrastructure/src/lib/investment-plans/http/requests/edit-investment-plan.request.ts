import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EditInvestmentPlanCommandInput } from '@investflow/investment-simulator-application';

export class EditInvestmentPlanRequest
  implements EditInvestmentPlanCommandInput
{
  @IsInt()
  @Min(1)
  revision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // Null clears the description; omitting it keeps the current one.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
