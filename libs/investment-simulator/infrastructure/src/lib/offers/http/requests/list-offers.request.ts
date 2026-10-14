import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ETitleType } from '@investflow/investment-simulator-domain';
import { ListOffersQuery } from '../../queries/list-offers.query-handler';
import type { OfferOrigin } from '../../queries/offer-projection';

export class ListOffersRequest implements Omit<ListOffersQuery, 'viewerId'> {
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
  @IsEnum(ETitleType)
  titleType?: ETitleType;

  @IsOptional()
  @IsIn(['SYSTEM', 'OWN'])
  origin?: OfferOrigin;
}
