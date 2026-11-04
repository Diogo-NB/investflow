import { EPublishedIndex } from '@investflow/market-data-domain';
import { CalendarDate } from '@investflow/shared-domain';

export class FetchNewPublishedIndexValuesCommand {
  private constructor(
    readonly index: EPublishedIndex,
    // Null starts the day after the last stored value.
    readonly startDate: CalendarDate | null,
  ) {}

  static of(
    index: EPublishedIndex,
    startDate: CalendarDate | null,
  ): FetchNewPublishedIndexValuesCommand {
    return new FetchNewPublishedIndexValuesCommand(index, startDate);
  }
}
