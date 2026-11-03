import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { investmentPlanListQuery } from '../../investment-plans/api/investment-plan-api';
import type { InvestmentPlanListItem } from '../../investment-plans/models/investment-plan.types';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import { toSearch } from '../../pagination/page-search';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  simulationListQuery,
  WORKSPACE_REFRESH_MS,
} from '../../simulations/api/simulation-api';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import {
  comparisonSearch,
  MAX_COMPARED,
  MIN_COMPARED,
  selectionSearch,
} from '../../simulations/utils/simulation-comparison-search';
import { parseSelection } from '../../simulations/utils/simulation-list-search';

const RECENT_SIMULATION_COUNT = 5;
const LISTED_PLAN_COUNT = 3;

export type HomeReadState<Data> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly data: Data };

export interface HomeList<Item> {
  readonly items: readonly Item[];
  readonly total: number;
}

function readState<Page, Data>(
  query: UseQueryResult<Page>,
  select: (page: Page) => Data,
): HomeReadState<Data> {
  if (query.data !== undefined) {
    return { status: 'ready', data: select(query.data) };
  }
  return query.isError
    ? { status: 'error', retrying: query.isFetching }
    : { status: 'loading' };
}

const toList = <Item>({ items, total }: PaginatedResult<Item>) => ({
  items,
  total,
});

// Only while a listed simulation is calculating, so its status settles.
const whileCalculating = ({
  state,
}: {
  readonly state: { readonly data?: PaginatedResult<SimulationListItem> };
}) =>
  state.data?.items.some((item) => item.calculationStatus === 'PENDING')
    ? WORKSPACE_REFRESH_MS
    : false;

export function useInvestmentSimulatorHome() {
  const fetchFn = useApiFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ids: selected, invalid: invalidSelection } =
    parseSelection(searchParams);

  const recent = useQuery({
    ...simulationListQuery(fetchFn, {
      page: 1,
      pageSize: RECENT_SIMULATION_COUNT,
    }),
    refetchInterval: whileCalculating,
  });
  const best = useQuery({
    ...simulationListQuery(fetchFn, {
      page: 1,
      pageSize: 1,
      sort: 'netAnnualReturn',
    }),
    refetchInterval: whileCalculating,
  });
  const actionRequired = useQuery(
    simulationListQuery(fetchFn, {
      page: 1,
      pageSize: 1,
      calculationStatus: 'INVALID',
    }),
  );
  const plans = useQuery({
    ...investmentPlanListQuery(fetchFn, {
      page: 1,
      pageSize: LISTED_PLAN_COUNT,
    }),
    refetchInterval: ({ state }) =>
      state.data?.items.some((plan) => plan.status.calculatingCount > 0)
        ? WORKSPACE_REFRESH_MS
        : false,
  });

  // Ticking boxes is not navigation, so it replaces the history entry.
  function updateSelection(ids: readonly string[]) {
    setSearchParams(withSelection(searchParams, ids), { replace: true });
  }

  return {
    // A malformed selection is corrected by navigating.
    correctedSearch: invalidSelection
      ? toSearch(withSelection(searchParams, selected))
      : null,
    recent: readState<
      PaginatedResult<SimulationListItem>,
      HomeList<SimulationListItem>
    >(recent, toList),
    // Null when no simulation has a successful result yet; the API ranks
    // those last.
    best: readState(best, (page) => {
      const [first] = page.items;
      return first?.result ? first : null;
    }),
    actionRequiredCount: readState(actionRequired, (page) => page.total),
    plans: readState<
      PaginatedResult<InvestmentPlanListItem>,
      HomeList<InvestmentPlanListItem>
    >(plans, toList),
    selected,
    canSelectMore: selected.length < MAX_COMPARED,
    // Null until enough simulations are selected.
    comparisonPath:
      selected.length >= MIN_COMPARED
        ? `/simulacoes/comparar${comparisonSearch(selected)}`
        : null,
    // The full list, keeping what is selected here.
    simulationListPath: `/simulacoes${selectionSearch(selected)}`,
    toggleSelected: (id: string) =>
      updateSelection(
        selected.includes(id)
          ? selected.filter((selectedId) => selectedId !== id)
          : [...selected, id].slice(0, MAX_COMPARED),
      ),
    clearSelection: () => updateSelection([]),
    retryRecent: () => void recent.refetch(),
    retryBest: () => void best.refetch(),
    retryActionRequired: () => void actionRequired.refetch(),
    retryPlans: () => void plans.refetch(),
  };
}

function withSelection(
  params: URLSearchParams,
  ids: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (ids.length) next.set('comparar', ids.join(','));
  else next.delete('comparar');
  return next;
}
