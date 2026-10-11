import { Transform, Type } from 'class-transformer';
import {
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EditOfferCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from './terms/offer-terms.request';

export class EditOfferRequest implements EditOfferCommandInput {
  @IsInt()
  @Min(1)
  revision!: number;

  @IsEmpty({ message: 'titleType cannot be changed' })
  titleType?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // Null clears the issuer; omitting it keeps the current one.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuerName?: string | null;

  @IsOptional()
  @IsCalendarDate()
  maturityDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RedemptionTermsRequest)
  redemptionTerms?: RedemptionTermsRequest;

  @IsOptional()
  @ValidateNested()
  @Type(() => RemunerationTermsRequest)
  remunerationTerms?: RemunerationTermsRequest;
}
