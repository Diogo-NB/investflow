import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { simulationListQuery } from '../api/simulation-api';
import type { SimulationListItem } from '../models/simulation.types';

export type SimulationListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly SimulationListItem[];
      readonly total: number;
      readonly lastPage: number;
      // A newer page is loading while the previous one stays visible.
      readonly updating: boolean;
    };

export function parsePage(param: string | null): number | null {
  if (param === null) return 1;
  return /^[1-9]\d{0,6}$/.test(param) ? Number(param) : null;
}

export function useSimulationList() {
  const fetchFn = useApiFetch();
  const [searchParams] = useSearchParams();
  const requested = parsePage(searchParams.get('page'));
  const page = requested ?? 1;
  const query = useQuery({
    ...simulationListQuery(fetchFn, page),
    placeholderData: keepPreviousData,
  });

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : null;
  // Malformed pages and pages past the end (after deletions) are corrected by
  // navigating, never by copying the URL into state.
  const correctedPage =
    requested === null
      ? 1
      : lastPage !== null && !query.isPlaceholderData && page > lastPage
        ? lastPage
        : null;

  const state: SimulationListState =
    query.data && lastPage !== null
      ? {
          status: 'ready',
          items: query.data.items,
          total: query.data.total,
          lastPage,
          updating: query.isPlaceholderData,
        }
      : query.isError
        ? { status: 'error', retrying: query.isFetching }
        : { status: 'loading' };

  return {
    page,
    state,
    correctedPage,
    retry: () => void query.refetch(),
  };
}
