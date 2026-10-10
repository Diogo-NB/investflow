import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumberString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SimulationInputsCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';
import {
  RedemptionTermsRequest,
  RemunerationTermsRequest,
} from '../../../offers/http/requests/terms/offer-terms.request';

export class SimulationInputsRequest implements SimulationInputsCommandInput {
  @IsNumberString({ no_symbols: false })
  principal!: string;

  @IsCalendarDate()
  investmentDate!: string;

  @IsOptional()
  @IsUUID()
  indexCurveId?: string | null;

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
