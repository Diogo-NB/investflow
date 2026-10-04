import { Injectable } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';

@Injectable()
export class SystemClock extends Clock {
  now(): UtcInstant {
    return UtcInstant.ofEpochMilliseconds(Date.now());
  }

  today(): CalendarDate {
    const result = CalendarDate.fromUtcInstant(this.now());
    if (result.isErr()) throw result.error;
    return result.value;
  }
}
