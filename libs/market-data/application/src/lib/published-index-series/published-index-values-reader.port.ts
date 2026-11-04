import {
  EPublishedIndex,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { CalendarDateRange, Result } from '@investflow/shared-domain';
import { PublishedIndexValuesFetchError } from './published-index-series.error';

export interface PublishedIndexValuesFetchInput {
  readonly index: EPublishedIndex;
  readonly range: CalendarDateRange;
}

// The values an index's publisher has made available.
export abstract class PublishedIndexValuesReader {
  // The values are sorted by date, and a range with nothing published is an
  // empty list.
  abstract fetchBetween(
    input: PublishedIndexValuesFetchInput,
  ): Promise<
    Result<readonly PublishedIndexValue[], PublishedIndexValuesFetchError>
  >;
}
