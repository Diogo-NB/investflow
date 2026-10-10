import { Controller, Get, Query } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { ListNonBusinessDaysQueryHandler } from '../queries/list-non-business-days.query-handler';
import { ListNonBusinessDaysRequest } from './requests/list-non-business-days.request';

@Controller('investment-simulator/business-calendar')
export class BusinessCalendarController {
  constructor(
    private readonly listNonBusinessDays: ListNonBusinessDaysQueryHandler,
  ) {}

  @Get('non-business-days')
  @SkipTransaction()
  nonBusinessDays(@Query() query: ListNonBusinessDaysRequest) {
    return this.listNonBusinessDays.execute({ year: query.year });
  }
}
