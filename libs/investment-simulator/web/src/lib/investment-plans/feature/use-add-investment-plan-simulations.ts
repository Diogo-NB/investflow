import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  SIMULATION_PAGE_SIZE,
  simulationKeys,
  simulationListQuery,
} from '../../simulations/api/simulation-api';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import type {
  SimulationListFilter,
  SimulationListFilters,
  SimulationListSort,
} from '../../simulations/utils/simulation-list-search';
import {
  addInvestmentPlanSimulations,
  investmentPlanKeys,
} from '../api/investment-plan-api';

export type SimulationPickerState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly SimulationListItem[];
      readonly total: number;
      readonly lastPage: number;
      readonly updating: boolean;
    };

/**
 * Picks the owner's simulations to add to a plan, up to its free slots, with
 * the simulation list's filters kept in memory instead of the URL. Members
 * already in the plan count as chosen and stay fixed; the choice outlives
 * filters that hide it.
 */
export function useAddInvestmentPlanSimulations({
  investmentPlanId,
  memberIds,
  availableSlots,
  onAdded,
}: {
  readonly investmentPlanId: string;
  readonly memberIds: readonly string[];
  readonly availableSlots: number;
  readonly onAdded: () => void;
}) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SimulationListFilters>({});
  const [sort, setSort] = useState<SimulationListSort>();
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const query = useQuery({
    ...simulationListQuery(fetchFn, { page, ...filters, sort }),
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    retry: 0,
    mutationFn: (simulationIds: readonly string[]) =>
      addInvestmentPlanSimulations(fetchFn, investmentPlanId, simulationIds),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: investmentPlanKeys.all }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
      ]);
      onAdded();
    },
  });
  // Rendered pending state lags a double click; this guard does not.
  const adding = useRef(false);

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / SIMULATION_PAGE_SIZE))
    : null;
  const state: SimulationPickerState =
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
  function updateList(change: () => void) {
    change();
    setPage(1);
  }

  return {
    state,
    page,
    setPage,
    filters,
    sort,
    filtered: Object.keys(filters).length > 0,
    setFilter: (name: SimulationListFilter, value: string | null) =>
      updateList(() =>
        setFilters((current) => {
          // The bar only offers values each filter accepts.
          const next: Record<string, string> = { ...current };
          if (value) next[name] = value;
          else delete next[name];
          return next as SimulationListFilters;
        }),
      ),
    clearFilters: () => updateList(() => setFilters({})),
    setSort: (value: SimulationListSort | null) =>
      updateList(() => setSort(value ?? undefined)),
    retry: () => void query.refetch(),
    chosen,
    isMember: (id: string) => memberIds.includes(id),
    canChooseMore: chosen.length < availableSlots,
    toggle: (id: string) =>
      setChosen((ids) =>
        ids.includes(id)
          ? ids.filter((chosenId) => chosenId !== id)
          : ids.length < availableSlots
            ? [...ids, id]
            : ids,
      ),
    submit: () => {
      if (adding.current || chosen.length === 0) return;
      adding.current = true;
      add.mutate(chosen, {
        onSettled: () => {
          adding.current = false;
        },
      });
    },
    pending: add.isPending,
    // The API's explanation, such as a full plan or a deleted simulation.
    problem:
      !add.isPending && add.error
        ? add.error instanceof ApiError && add.error.userMessage
          ? add.error.userMessage
          : 'Não foi possível adicionar. Verifique sua conexão e tente novamente.'
        : null,
  };
}
