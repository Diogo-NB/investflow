import { Controller, Get, Query } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { GetBusinessCalendarQueryHandler } from '../queries/get-business-calendar.query-handler';
import { GetBusinessCalendarRequest } from './requests/get-business-calendar.request';

@Controller('investment-simulator/business-calendar')
export class BusinessCalendarController {
  constructor(private readonly getCalendar: GetBusinessCalendarQueryHandler) {}

  @Get()
  @SkipTransaction()
  get(@Query() query: GetBusinessCalendarRequest) {
    return this.getCalendar.execute(query);
  }
}
