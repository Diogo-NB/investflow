import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  simulationListQuery,
  WORKSPACE_REFRESH_MS,
} from '../api/simulation-api';
import type { SimulationListItem } from '../models/simulation.types';
import { parsePage, toSearch, withPage } from '../../pagination/page-search';
import {
  LIST_FILTERS,
  parseFilters,
  parseSort,
  type SimulationListFilter,
  type SimulationListSort,
} from '../utils/simulation-list-search';

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

export function useSimulationList() {
  const fetchFn = useApiFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, invalid } = parseFilters(searchParams);
  const { sort, invalid: invalidSort } = parseSort(searchParams);
  const requested = parsePage(searchParams.get('page'));
  const page = requested ?? 1;
  const query = useQuery({
    ...simulationListQuery(fetchFn, { page, ...filters, sort }),
    placeholderData: keepPreviousData,
    // Only while a row is calculating, so its status settles on screen.
    refetchInterval: ({ state }) =>
      state.data?.items.some((item) => item.calculationStatus === 'PENDING')
        ? WORKSPACE_REFRESH_MS
        : false,
  });

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : null;
  // Malformed values and pages past the end (after deletions) are corrected
  // by navigating, never by copying the URL into state.
  const correctedPage =
    requested === null
      ? 1
      : lastPage !== null && !query.isPlaceholderData && page > lastPage
        ? lastPage
        : null;
  const correctedSearch = (() => {
    if (invalid.length === 0 && !invalidSort && correctedPage === null) {
      return null;
    }
    const next = new URLSearchParams(searchParams);
    for (const name of invalid) next.delete(name);
    if (invalidSort) next.delete('sort');
    return withPage(next, correctedPage ?? page);
  })();

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

  // A different filter or order means a different list, which starts at its
  // first page.
  function updateList(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    change(next);
    next.delete('page');
    setSearchParams(next);
  }

  return {
    page,
    filters,
    sort,
    filtered: Object.keys(filters).length > 0,
    state,
    correctedSearch,
    search: toSearch(searchParams),
    setFilter: (name: SimulationListFilter, value: string | null) =>
      updateList((next) => {
        if (value) next.set(name, value);
        else next.delete(name);
      }),
    clearFilters: () =>
      updateList((next) => {
        for (const name of LIST_FILTERS) next.delete(name);
      }),
    setSort: (value: SimulationListSort | null) =>
      updateList((next) => {
        if (value) next.set('sort', value);
        else next.delete('sort');
      }),
    retry: () => void query.refetch(),
  };
}
