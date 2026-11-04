import { Injectable } from '@nestjs/common';
import { PublishedIndexSeries } from '@investflow/market-data-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, NotFoundError, Result } from '@investflow/shared-domain';
import { PublishedIndexSeriesRepository } from '../published-index-series.repository';
import { RecordPublishedIndexValuesCommand } from './record-published-index-values.command';

@Injectable()
export class RecordPublishedIndexValuesUseCase
  implements CommandHandler<RecordPublishedIndexValuesCommand, void>
{
  constructor(
    private readonly seriesRepository: PublishedIndexSeriesRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RecordPublishedIndexValuesCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.seriesRepository.findByIndexAndYear(
      command.index,
      command.year,
    );
    if (found.isErr() && !(found.error instanceof NotFoundError)) return found;
    const series =
      found.valueOrNull ??
      PublishedIndexSeries.create(command.index, command.year);

    const appended = series.append(command.values, this.clock.now());
    if (appended.isErr()) return appended;
    return this.seriesRepository.save(series);
  }
}
