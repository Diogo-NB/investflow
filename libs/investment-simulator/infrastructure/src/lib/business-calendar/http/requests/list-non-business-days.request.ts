import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ListNonBusinessDaysQuery } from '../../queries/list-non-business-days.query-handler';

export class ListNonBusinessDaysRequest implements ListNonBusinessDaysQuery {
  // Bounds the work per request; calendar holidays need Gregorian years.
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;
}
