import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ListInvestmentPlansQuery } from '../../queries/list-investment-plans.query-handler';

export class ListInvestmentPlansRequest
  implements Omit<ListInvestmentPlansQuery, 'ownerId'>
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
  simulationId?: string;
}
