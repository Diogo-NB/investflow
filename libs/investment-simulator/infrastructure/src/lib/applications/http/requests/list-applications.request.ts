import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListApplicationsRequest {
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
}
