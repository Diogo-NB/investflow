import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateOfferCommandInput } from '@investflow/investment-simulator-application';
import { TitleType } from '@investflow/investment-simulator-domain';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from './terms/offer-terms.request';

export class CreateOfferRequest implements CreateOfferCommandInput {
  @IsEnum(TitleType)
  titleType!: TitleType;

  @IsUUID()
  issuerId!: string;

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
