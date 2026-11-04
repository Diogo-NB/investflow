import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  CalendarDateRange,
  NotFoundError,
  Result,
} from '@investflow/shared-domain';
import { PublishedIndexValue } from '@investflow/market-data-domain';
import { PublishedIndexImportStartDateMissingError } from '../published-index-series.error';
import { PublishedIndexSeriesRepository } from '../published-index-series.repository';
import { PublishedIndexValuesOfYear } from '../published-index-values-of-year.type';
import { PublishedIndexValuesReader } from '../published-index-values-reader.port';
import { FetchNewPublishedIndexValuesCommand } from './fetch-new-published-index-values.command';

@Injectable()
export class FetchNewPublishedIndexValuesUseCase
  implements
    CommandHandler<
      FetchNewPublishedIndexValuesCommand,
      readonly PublishedIndexValuesOfYear[]
    >
{
  constructor(
    private readonly seriesRepository: PublishedIndexSeriesRepository,
    private readonly reader: PublishedIndexValuesReader,
    private readonly clock: Clock,
  ) {}

  // One batch per year, oldest first, because each year is its own aggregate.
  async execute(
    command: FetchNewPublishedIndexValuesCommand,
  ): Promise<Result<readonly PublishedIndexValuesOfYear[], AppError>> {
    const start = await this.startDate(command);
    if (start.isErr()) return start;

    // A publisher may list dates ahead of today, whose values can still change.
    const today = this.clock.today();
    if (start.value.isAfter(today)) return Result.ok([]);

    const fetched = await this.reader.fetchBetween({
      index: command.index,
      range: CalendarDateRange.of(start.value, today),
    });
    if (fetched.isErr()) return fetched;

    const valuesByYear = new Map<number, PublishedIndexValue[]>();
    for (const published of fetched.value) {
      const { year } = published.referenceDate;
      valuesByYear.set(year, [...(valuesByYear.get(year) ?? []), published]);
    }
    return Result.ok(
      [...valuesByYear].map(([year, values]) => ({
        index: command.index,
        year,
        values,
      })),
    );
  }

  private async startDate(
    command: FetchNewPublishedIndexValuesCommand,
  ): Promise<Result<CalendarDate, AppError>> {
    if (command.startDate) return Result.ok(command.startDate);

    const latest = await this.seriesRepository.findLatest(command.index);
    if (latest.isErr() && !(latest.error instanceof NotFoundError)) {
      return latest;
    }
    const last = latest.valueOrNull?.lastReferenceDate;
    if (last) return Result.ok(last.addDays(1));
    return Result.err(
      new PublishedIndexImportStartDateMissingError(command.index),
    );
  }
}
