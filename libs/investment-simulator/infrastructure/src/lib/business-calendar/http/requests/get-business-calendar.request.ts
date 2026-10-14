import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { GetBusinessCalendarQuery } from '../../queries/get-business-calendar.query-handler';

export class GetBusinessCalendarRequest implements GetBusinessCalendarQuery {
  // Bounds the work per request; calendar holidays need Gregorian years.
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  fromYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  toYear!: number;
}
