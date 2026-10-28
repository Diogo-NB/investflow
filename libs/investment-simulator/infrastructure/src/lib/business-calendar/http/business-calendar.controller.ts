import { Controller, Get, Query, Res } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { GetBusinessCalendarQueryHandler } from '../queries/get-business-calendar.query-handler';
import { GetBusinessCalendarRequest } from './requests/get-business-calendar.request';

@Controller('investment-simulator/business-calendar')
export class BusinessCalendarController {
  constructor(private readonly getCalendar: GetBusinessCalendarQueryHandler) {}

  @Get()
  @SkipTransaction()
  async get(
    @Query() query: GetBusinessCalendarRequest,
    @Res({ passthrough: true })
    response: { setHeader: (name: string, value: string) => void },
  ) {
    const result = await this.getCalendar.execute(query);
    // Only a success may be stored: explicit freshness makes an error
    // cacheable too, which @Header() would set before the handler runs.
    // Express answers revalidations with 304 through its body-hash ETag, so a
    // holiday rule change reaches browsers within a day. The response is
    // bearer-authenticated, so shared caches must not store it.
    if (result.isOk()) {
      response.setHeader('Cache-Control', 'private, max-age=86400');
    }
    return result;
  }
}
