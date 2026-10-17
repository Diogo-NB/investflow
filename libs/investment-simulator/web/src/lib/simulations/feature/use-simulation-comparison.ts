import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  simulationComparisonQuery,
  WORKSPACE_REFRESH_MS,
} from '../api/simulation-api';
import type { SimulationComparison } from '../models/simulation.types';
import {
  comparisonSearch,
  MAX_COMPARED,
  MIN_COMPARED,
  parseSimulationIds,
  selectionSearch,
} from '../utils/simulation-comparison-search';

export type SimulationComparisonState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  // A compared simulation was deleted.
  | { readonly status: 'missing' }
  | {
      readonly status: 'ready';
      readonly comparison: SimulationComparison;
      // Other simulations are loading while the previous ones stay visible.
      readonly updating: boolean;
    };

export function useSimulationComparison() {
  const fetchFn = useApiFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ids, invalid } = parseSimulationIds(searchParams.get('ids'));
  const enough = ids.length >= MIN_COMPARED;
  const query = useQuery({
    ...simulationComparisonQuery(fetchFn, ids),
    enabled: enough && !invalid,
    placeholderData: keepPreviousData,
    // Only while a simulation is calculating, so its status settles on screen.
    refetchInterval: ({ state }) =>
      state.data?.simulations.some(
        ({ calculation }) => calculation.status === 'PENDING',
      )
        ? WORKSPACE_REFRESH_MS
        : false,
  });

  const missing = query.error instanceof ApiError && query.error.status === 404;
  const state: SimulationComparisonState = missing
    ? { status: 'missing' }
    : query.data
      ? {
          status: 'ready',
          comparison: query.data,
          updating: query.isPlaceholderData,
        }
      : query.isError
        ? { status: 'error', retrying: query.isFetching }
        : { status: 'loading' };

  return {
    ids,
    state,
    // Fewer than two simulations go back to the list to pick more; anything
    // malformed is dropped from the URL.
    listRedirect: enough ? null : selectionSearch(ids),
    correctedSearch: enough && invalid ? comparisonSearch(ids) : null,
    // The list with these simulations selected, to add or change them.
    selectionSearch: selectionSearch(ids),
    canAdd: ids.length < MAX_COMPARED,
    remove: (id: string) =>
      setSearchParams(
        new URLSearchParams({
          ids: ids.filter((compared) => compared !== id).join(','),
        }),
      ),
    retry: () => void query.refetch(),
  };
}
