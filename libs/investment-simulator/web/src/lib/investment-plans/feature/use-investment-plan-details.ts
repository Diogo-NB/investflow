import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  simulationKeys,
  simulationListQuery,
  WORKSPACE_REFRESH_MS,
} from '../../simulations/api/simulation-api';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import {
  comparisonSearch,
  MAX_COMPARED,
  MIN_COMPARED,
} from '../../simulations/utils/simulation-comparison-search';
import {
  parseSort,
  type SimulationListSort,
} from '../../simulations/utils/simulation-list-search';
import { toSearch } from '../../pagination/page-search';
import {
  deleteInvestmentPlan,
  investmentPlanDetailQuery,
  investmentPlanKeys,
  removeInvestmentPlanSimulation,
} from '../api/investment-plan-api';
import type { InvestmentPlanDetail } from '../models/investment-plan.types';

// Above the limit, so one page holds every member.
const MEMBERS_PAGE_SIZE = 100;

export type InvestmentPlanDetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly plan: InvestmentPlanDetail };

export type InvestmentPlanMembersState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly SimulationListItem[];
      // Another order is loading while the previous one stays visible.
      readonly updating: boolean;
    };

export function useInvestmentPlanDetails(investmentPlanId: string) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort, invalid: invalidSort } = parseSort(searchParams);
  const plan = useQuery({
    ...investmentPlanDetailQuery(fetchFn, investmentPlanId),
    // Only while a member is calculating, so the status settles on screen.
    refetchInterval: ({ state }) =>
      (state.data?.status.calculatingCount ?? 0) > 0
        ? WORKSPACE_REFRESH_MS
        : false,
  });
  const calculating = (plan.data?.status.calculatingCount ?? 0) > 0;
  const members = useQuery({
    ...simulationListQuery(fetchFn, {
      investmentPlanId,
      page: 1,
      pageSize: MEMBERS_PAGE_SIZE,
      sort,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: calculating ? WORKSPACE_REFRESH_MS : false,
  });
  const [selected, setSelected] = useState<readonly string[]>([]);
  // The member being removed; one at a time.
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Rendered pending state lags a double click; these guards do not.
  const removingMember = useRef(false);
  const deleting = useRef(false);

  const removeMember = useMutation({
    retry: 0,
    mutationFn: (simulationId: string) =>
      removeInvestmentPlanSimulation(fetchFn, investmentPlanId, simulationId),
    onSuccess: async (_, simulationId) => {
      setSelected((ids) => ids.filter((id) => id !== simulationId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: investmentPlanKeys.all }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
      ]);
    },
    onSettled: () => {
      removingMember.current = false;
      setRemovingId(null);
    },
  });

  const remove = useMutation({
    retry: 0,
    mutationFn: () => deleteInvestmentPlan(fetchFn, investmentPlanId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: investmentPlanKeys.lists(),
      });
      // Dropped only once the list has replaced this page: while a lazy
      // route loads, the page is still mounted and would refetch it.
      await navigate('/planos');
      queryClient.removeQueries({
        queryKey: investmentPlanKeys.detail(investmentPlanId),
      });
    },
  });

  const state: InvestmentPlanDetailsState = plan.data
    ? { status: 'ready', plan: plan.data }
    : plan.isError
      ? plan.error instanceof ApiError && plan.error.status === 404
        ? { status: 'missing' }
        : { status: 'error', retrying: plan.isFetching }
      : { status: 'loading' };

  const membersState: InvestmentPlanMembersState = members.data
    ? {
        status: 'ready',
        items: members.data.items,
        updating: members.isPlaceholderData,
      }
    : members.isError
      ? { status: 'error', retrying: members.isFetching }
      : { status: 'loading' };

  return {
    state,
    members: {
      state: membersState,
      // Read with the members, so ids added or removed elsewhere stay out.
      ids: members.data?.items.map(({ id }) => id) ?? [],
      retry: () => void members.refetch(),
    },
    sort,
    // An unknown order is corrected by navigating.
    correctedSearch: invalidSort
      ? toSearch(
          new URLSearchParams(
            [...searchParams].filter(([name]) => name !== 'sort'),
          ),
        )
      : null,
    setSort: (value: SimulationListSort | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set('sort', value);
      else next.delete('sort');
      setSearchParams(next, { replace: true });
    },
    selection: {
      selected,
      canSelectMore: selected.length < MAX_COMPARED,
      toggle: (id: string) =>
        setSelected((ids) =>
          ids.includes(id)
            ? ids.filter((selectedId) => selectedId !== id)
            : [...ids, id].slice(0, MAX_COMPARED),
        ),
      clear: () => setSelected([]),
      // Null until enough simulations are selected.
      comparisonPath:
        selected.length >= MIN_COMPARED
          ? `/simulacoes/comparar${comparisonSearch(selected)}`
          : null,
    },
    retry: () => void plan.refetch(),
    removeMember: {
      run: (simulationId: string) => {
        if (removingMember.current) return;
        removingMember.current = true;
        setRemovingId(simulationId);
        removeMember.mutate(simulationId);
      },
      removingId,
      // The member whose removal failed, until the next attempt.
      failedId:
        !removeMember.isPending && removeMember.isError
          ? (removeMember.variables ?? null)
          : null,
    },
    remove: {
      run: () => {
        if (deleting.current) return;
        deleting.current = true;
        remove.mutate(undefined, {
          onSettled: () => {
            deleting.current = false;
          },
        });
      },
      pending: remove.isPending,
      failed: remove.isError,
    },
  };
}
