import { useQuery } from '@tanstack/react-query';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  latestPublishedIndexValuesQuery,
  type LatestPublishedIndexValue,
} from '../api/latest-published-index-values-api';

export type LatestPublishedIndexValuesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly values: readonly LatestPublishedIndexValue[];
    };

export function useLatestPublishedIndexValues() {
  const query = useQuery(latestPublishedIndexValuesQuery(useApiFetch()));
  const state: LatestPublishedIndexValuesState = query.data
    ? { status: 'ready', values: query.data }
    : query.isError
      ? { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };
  return { state, retry: () => void query.refetch() };
}
