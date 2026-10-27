import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { parsePage, toSearch, withPage } from '../../pagination/page-search';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { WORKSPACE_REFRESH_MS } from '../../simulations/api/simulation-api';
import { investmentPlanListQuery } from '../api/investment-plan-api';
import type { InvestmentPlanListItem } from '../models/investment-plan.types';

export type InvestmentPlanListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly InvestmentPlanListItem[];
      readonly total: number;
      readonly lastPage: number;
      // A newer page is loading while the previous one stays visible.
      readonly updating: boolean;
    };

export function useInvestmentPlanList() {
  const fetchFn = useApiFetch();
  const [searchParams] = useSearchParams();
  const requested = parsePage(searchParams.get('page'));
  const page = requested ?? 1;
  const query = useQuery({
    ...investmentPlanListQuery(fetchFn, { page }),
    placeholderData: keepPreviousData,
    // Only while a member is calculating, so the plan's status settles.
    refetchInterval: ({ state }) =>
      state.data?.items.some((plan) => plan.status.calculatingCount > 0)
        ? WORKSPACE_REFRESH_MS
        : false,
  });

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : null;
  // A malformed page or one past the end (after deletions) is corrected by
  // navigating.
  const correctedPage =
    requested === null
      ? 1
      : lastPage !== null && !query.isPlaceholderData && page > lastPage
        ? lastPage
        : null;

  const state: InvestmentPlanListState =
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
    correctedSearch:
      correctedPage === null ? null : withPage(searchParams, correctedPage),
    search: toSearch(searchParams),
    retry: () => void query.refetch(),
  };
}
