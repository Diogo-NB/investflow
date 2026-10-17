import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ESimulationCalculationStatus,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { ListSimulationsQuery } from '../../queries/list-simulations.query-handler';

const REMUNERATION_KINDS = [
  'PREFIXED',
  'CDI_PERCENTAGE',
  'SELIC_PERCENTAGE',
  'IPCA_PLUS',
] as const;

export class ListSimulationsRequest
  implements Omit<ListSimulationsQuery, 'ownerId'>
{
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

  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsOptional()
  @IsUUID()
  curveId?: string;

  @IsOptional()
  @IsEnum(ETitleType)
  titleType?: ETitleType;

  @IsOptional()
  @IsIn(REMUNERATION_KINDS)
  remunerationKind?: (typeof REMUNERATION_KINDS)[number];

  @IsOptional()
  @IsEnum(ESimulationCalculationStatus)
  calculationStatus?: ESimulationCalculationStatus;

  @IsOptional()
  @IsIn(['netAnnualReturn'])
  sort?: 'netAnnualReturn';
}
