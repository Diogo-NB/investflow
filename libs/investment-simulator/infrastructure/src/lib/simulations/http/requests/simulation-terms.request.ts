import { Type } from 'class-transformer';
import { IsDefined, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { SimulationTermsCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from '../../../offers/http/requests/terms/offer-terms.request';

export class SimulationTermsRequest implements SimulationTermsCommandInput {
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
