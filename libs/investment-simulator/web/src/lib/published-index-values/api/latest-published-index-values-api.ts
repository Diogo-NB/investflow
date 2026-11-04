import { queryOptions } from '@tanstack/react-query';
import { requestJson, type FetchFn } from '../../http/request-json';

export type PublishedIndex = 'CDI' | 'SELIC' | 'SELIC_TARGET';

export interface LatestPublishedIndexValue {
  readonly index: PublishedIndex;
  readonly referenceDate: string;
  // A fraction: 13.65% is 0.1365.
  readonly value: string;
}

interface LatestPublishedIndexValues {
  // An index with nothing stored yet is absent.
  readonly items: readonly LatestPublishedIndexValue[];
}

export const publishedIndexValueKeys = {
  latest: () => ['published-index-values', 'latest'] as const,
};

// Values arrive at most a few times a day, and the screens show each one's date.
const STALE_TIME_MS = 15 * 60 * 1000;

export function latestPublishedIndexValuesQuery(fetchFn: FetchFn) {
  return queryOptions({
    queryKey: publishedIndexValueKeys.latest(),
    queryFn: ({ signal }) =>
      requestJson<LatestPublishedIndexValues>(
        fetchFn,
        '/api/market-data/published-index-values/latest',
        { signal },
      ),
    select: ({ items }) => items,
    staleTime: STALE_TIME_MS,
  });
}
