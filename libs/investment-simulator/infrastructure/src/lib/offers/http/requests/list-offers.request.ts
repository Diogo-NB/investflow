import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TitleType } from '@investflow/investment-simulator-domain';
import { ListOffersQuery } from '../../queries/list-offers.query-handler';

export class ListOffersRequest implements ListOffersQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(TitleType)
  titleType?: TitleType;
}
