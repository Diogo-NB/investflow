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
  deleteOffer,
  duplicateOffer,
  offerDetailQuery,
  offerKeys,
} from '../api/offer-api';
import type { OfferSummary } from '../models/offer.types';
import { offerListSearch } from '../utils/offer-list-search';

export type OfferDetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly offer: OfferSummary };

// The user's simulations that use the offer; total also says how many a
// change or deletion affects.
export type OfferSimulationsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly SimulationListItem[];
      readonly total: number;
    };

/** The first page of the user's simulations that use an offer. */
export function useOfferSimulations(offerId: string | undefined) {
  const fetchFn = useApiFetch();
  const query = useQuery({
    ...simulationListQuery(fetchFn, { offerId: offerId ?? '', page: 1 }),
    enabled: offerId !== undefined,
  });
  const state: OfferSimulationsState = query.data
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

export function useOfferDetails(offerId: string) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listSearch = offerListSearch(searchParams);
  const query = useQuery(offerDetailQuery(fetchFn, offerId));
  const simulations = useOfferSimulations(offerId);

  const duplicate = useMutation({
    retry: 0,
    mutationFn: () => duplicateOffer(fetchFn, offerId),
    onSuccess: async ({ offerId: copyId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
      ]);
      navigate(`/ofertas/${copyId}${listSearch}`);
    },
  });

  const remove = useMutation({
    retry: 0,
    mutationFn: () => deleteOffer(fetchFn, offerId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.lists() }),
        // Its simulations now show it as deleted.
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]);
      // Dropped only once the list has replaced this page: while a lazy
      // route loads, the page is still mounted and would refetch it.
      await navigate(`/ofertas${listSearch}`);
      queryClient.removeQueries({ queryKey: offerKeys.detail(offerId) });
    },
  });

  // Rendered pending state lags a double click; this guard does not, so one
  // click creates one copy.
  const duplicating = useRef(false);

  const state: OfferDetailsState = query.data
    ? { status: 'ready', offer: query.data }
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
