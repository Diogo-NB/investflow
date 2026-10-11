import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EditCurveCommandInput } from '@investflow/investment-simulator-application';
import { CurveIntervalRequest } from './curve-interval.request';

export class EditCurveRequest implements EditCurveCommandInput {
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurveIntervalRequest)
  intervals?: CurveIntervalRequest[];
}
