import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../../simulations/api/simulation-api';
import {
  addInvestmentPlanSimulations,
  INVESTMENT_PLAN_PAGE_SIZE,
  investmentPlanKeys,
  investmentPlanListQuery,
} from '../api/investment-plan-api';
import type { InvestmentPlanListItem } from '../models/investment-plan.types';

// The plans line names at most this many; total counts every one.
const MEMBERSHIPS_PAGE_SIZE = 100;

export type SimulationInvestmentPlansState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly InvestmentPlanListItem[];
      readonly total: number;
    };

/** The plans a simulation belongs to, by name. */
export function useSimulationInvestmentPlans(simulationId: string) {
  const fetchFn = useApiFetch();
  const query = useQuery(
    investmentPlanListQuery(fetchFn, {
      page: 1,
      pageSize: MEMBERSHIPS_PAGE_SIZE,
      simulationId,
    }),
  );
  const state: SimulationInvestmentPlansState = query.data
    ? { status: 'ready', items: query.data.items, total: query.data.total }
    : query.isError
      ? { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };
  return { state, retry: () => void query.refetch() };
}

export type InvestmentPlanPickerState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly items: readonly InvestmentPlanListItem[];
      readonly total: number;
      readonly lastPage: number;
      readonly updating: boolean;
    };

/**
 * Lists the owner's plans, by name, to add one simulation to them one at a
 * time. memberIds are the plans it is known to belong to; a plan missing
 * from them only costs an add that changes nothing.
 */
export function useSimulationInvestmentPlanPicker({
  simulationId,
  memberIds,
}: {
  readonly simulationId: string;
  readonly memberIds: readonly string[];
}) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useQuery({
    ...investmentPlanListQuery(fetchFn, { page }),
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    retry: 0,
    mutationFn: (plan: InvestmentPlanListItem) =>
      addInvestmentPlanSimulations(fetchFn, plan.id, [simulationId]),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: investmentPlanKeys.all }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
      ]),
  });
  // Rendered pending state lags a double click; this guard does not.
  const adding = useRef(false);

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / INVESTMENT_PLAN_PAGE_SIZE))
    : null;
  const state: InvestmentPlanPickerState =
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

  const failedPlan = !add.isPending && add.isError ? add.variables : null;
  return {
    state,
    page,
    setPage,
    retry: () => void query.refetch(),
    isMember: (plan: InvestmentPlanListItem) => memberIds.includes(plan.id),
    isFull: (plan: InvestmentPlanListItem) =>
      plan.availableSimulationSlots === 0,
    add: (plan: InvestmentPlanListItem) => {
      if (adding.current) return;
      adding.current = true;
      add.mutate(plan, {
        onSettled: () => {
          adding.current = false;
        },
      });
    },
    pendingPlanId: add.isPending ? add.variables.id : null,
    addedPlan: add.isSuccess ? add.variables : null,
    problem: failedPlan
      ? `Não foi possível adicionar ao plano ${failedPlan.name}. ${
          add.error instanceof ApiError && add.error.userMessage
            ? add.error.userMessage
            : 'Verifique sua conexão e tente novamente.'
        }`
      : null,
  };
}
