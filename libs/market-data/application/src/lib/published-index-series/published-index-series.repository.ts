import {
  EPublishedIndex,
  PublishedIndexSeries,
} from '@investflow/market-data-domain';
import { AppError, Repository, Result } from '@investflow/shared-domain';

export abstract class PublishedIndexSeriesRepository extends Repository<PublishedIndexSeries> {
  // Report a missing series as PublishedIndexSeriesNotFoundError.
  abstract findByIndexAndYear(
    index: EPublishedIndex,
    year: number,
  ): Promise<Result<PublishedIndexSeries, AppError>>;

  abstract findLatest(
    index: EPublishedIndex,
  ): Promise<Result<PublishedIndexSeries, AppError>>;
}
