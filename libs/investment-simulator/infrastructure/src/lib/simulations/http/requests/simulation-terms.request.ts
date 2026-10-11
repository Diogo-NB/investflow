import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SimulationTermsCommandInput } from '@investflow/investment-simulator-application';
import { ETitleType } from '@investflow/investment-simulator-domain';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from '../../../offers/http/requests/terms/offer-terms.request';

export class SimulationTermsRequest implements SimulationTermsCommandInput {
  @IsEnum(ETitleType)
  titleType!: ETitleType;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuerName?: string | null;

  @IsCalendarDate()
  maturityDate!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => RedemptionTermsRequest)
  redemptionTerms!: RedemptionTermsRequest;

  @IsDefined()
  @ValidateNested()
  @Type(() => RemunerationTermsRequest)
  remunerationTerms!: RemunerationTermsRequest;
}
