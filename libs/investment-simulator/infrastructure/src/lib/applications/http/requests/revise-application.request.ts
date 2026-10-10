import { Type } from 'class-transformer';
import {
  IsNumberString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApplicationInvestmentCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from '../../../offers/http/requests/terms/offer-terms.request';

export class ReviseApplicationRequest
  implements ApplicationInvestmentCommandInput
{
  @IsNumberString({ no_symbols: false })
  principal!: string;

  @IsCalendarDate()
  investmentDate!: string;

  @IsOptional()
  @IsUUID()
  indexCurveId?: string | null;

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
