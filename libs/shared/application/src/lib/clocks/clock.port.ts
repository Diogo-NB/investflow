import { CalendarDate, UtcInstant } from '@investflow/shared-domain';

export abstract class Clock {
  abstract now(): UtcInstant;

  abstract today(): CalendarDate;
}
