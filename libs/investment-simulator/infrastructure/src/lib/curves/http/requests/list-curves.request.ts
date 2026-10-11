import { IsEnum, IsOptional } from 'class-validator';
import { EEconomicIndex } from '@investflow/investment-simulator-domain';

export class ListCurvesRequest {
  @IsOptional()
  @IsEnum(EEconomicIndex)
  index?: EEconomicIndex;
}
