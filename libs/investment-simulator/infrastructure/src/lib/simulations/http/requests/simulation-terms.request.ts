import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsOptional,
  IsUUID,
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

  @IsOptional()
  @IsUUID()
  issuerId?: string | null;

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
