import { Type } from 'class-transformer';
import { IsEmpty, IsOptional, ValidateNested } from 'class-validator';
import { UpdateOfferCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from './terms/offer-terms.request';

export class UpdateOfferRequest implements UpdateOfferCommandInput {
  @IsEmpty({ message: 'titleType cannot be updated' })
  titleType?: unknown;

  @IsEmpty({ message: 'issuerName cannot be updated' })
  issuerName?: unknown;

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
