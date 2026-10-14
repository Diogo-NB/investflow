import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  simulationKeys,
  simulationListQuery,
} from '../../simulations/api/simulation-api';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import {
  curveDetailQuery,
  curveKeys,
  deleteCurve,
  duplicateCurve,
} from '../api/curve-api';
import type { CurveDetail } from '../models/curve.types';
import { curveListSearch } from '../utils/curve-list-search';

export type CurveDetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly curve: CurveDetail };

// The user's simulations that use the curve; total also says how many a
// change or deletion affects.
export type CurveSimulationsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly SimulationListItem[];
      readonly total: number;
    };

/** The first page of the user's simulations that use a curve. */
export function useCurveSimulations(curveId: string | undefined) {
  const fetchFn = useApiFetch();
  const query = useQuery({
    ...simulationListQuery(fetchFn, { curveId: curveId ?? '', page: 1 }),
    enabled: curveId !== undefined,
  });
  const state: CurveSimulationsState = query.data
    ? {
        status: 'ready',
        items: query.data.items,
        total: query.data.total,
      }
    : query.isError
      ? { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };
  return { state, retry: () => void query.refetch() };
}

export function useCurveDetails(curveId: string) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listSearch = curveListSearch(searchParams);
  const query = useQuery(curveDetailQuery(fetchFn, curveId));
  const simulations = useCurveSimulations(curveId);

  const duplicate = useMutation({
    retry: 0,
    mutationFn: () => duplicateCurve(fetchFn, curveId),
    onSuccess: async ({ curveId: copyId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: curveKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
      ]);
      navigate(`/curvas/${copyId}${listSearch}`);
    },
  });

  const remove = useMutation({
    retry: 0,
    mutationFn: () => deleteCurve(fetchFn, curveId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: curveKeys.lists() }),
        // Its simulations now show it as deleted.
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]);
      // Dropped only once the list has replaced this page: while a lazy
      // route loads, the page is still mounted and would refetch it.
      await navigate(`/curvas${listSearch}`);
      queryClient.removeQueries({ queryKey: curveKeys.detail(curveId) });
    },
  });

  // Rendered pending state lags a double click; this guard does not, so one
  // click creates one copy.
  const duplicating = useRef(false);

  const state: CurveDetailsState = query.data
    ? { status: 'ready', curve: query.data }
    : query.isError
      ? query.error instanceof ApiError && query.error.status === 404
        ? { status: 'missing' }
        : { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };

  return {
    state,
    listSearch,
    retry: () => void query.refetch(),
    simulations,
    duplicate: {
      run: () => {
        if (duplicating.current) return;
        duplicating.current = true;
        duplicate.mutate(undefined, {
          onSettled: () => {
            duplicating.current = false;
          },
        });
      },
      pending: duplicate.isPending,
      failed: duplicate.isError,
    },
    remove: {
      run: () => {
        if (!remove.isPending) remove.mutate();
      },
      pending: remove.isPending,
      failed: remove.isError,
    },
  };
}
