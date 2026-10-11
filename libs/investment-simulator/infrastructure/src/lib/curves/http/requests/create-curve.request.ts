import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateCurveCommandInput } from '@investflow/investment-simulator-application';
import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import { CurveIntervalRequest } from './curve-interval.request';

export class CreateCurveRequest implements CreateCurveCommandInput {
  @IsEnum(EEconomicIndex)
  index!: EEconomicIndex;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurveIntervalRequest)
  intervals!: CurveIntervalRequest[];
}
