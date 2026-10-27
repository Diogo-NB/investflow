import { queryOptions } from '@tanstack/react-query';
import { jsonBody, requestJson, type FetchFn } from '../../http/request-json';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import type {
  MonthlyBalance,
  SimulationComparison,
  SimulationInput,
  SimulationListItem,
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';
import type {
  SimulationListFilters,
  SimulationListSort,
} from '../utils/simulation-list-search';

const BASE = '/api/investment-simulator';
export const SIMULATION_PAGE_SIZE = 20;

export interface SimulationListRequest extends SimulationListFilters {
  readonly page: number;
  // Only the plan's members.
  readonly investmentPlanId?: string;
  readonly pageSize?: number;
  readonly sort?: SimulationListSort;
}

export const simulationKeys = {
  all: ['simulations'] as const,
  lists: () => [...simulationKeys.all, 'list'] as const,
  list: (request: SimulationListRequest) =>
    [...simulationKeys.lists(), request] as const,
  options: () => [...simulationKeys.all, 'options'] as const,
  workspace: (id: string) => [...simulationKeys.all, 'workspace', id] as const,
  comparison: (ids: readonly string[]) =>
    [...simulationKeys.all, 'comparison', ids] as const,
  monthlyBalances: (simulationId: string, calculatedAt: string) =>
    [
      ...simulationKeys.all,
      'monthly-balances',
      simulationId,
      calculatedAt,
    ] as const,
};

export function simulationListQuery(
  fetchFn: FetchFn,
  { pageSize = SIMULATION_PAGE_SIZE, ...request }: SimulationListRequest,
) {
  const params = { ...request, pageSize };
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(pageSize),
  });
  for (const [name, value] of Object.entries(request)) {
    if (name !== 'page' && value !== undefined) search.set(name, String(value));
  }
  return queryOptions({
    queryKey: simulationKeys.list(params),
    queryFn: ({ signal }) =>
      requestJson<PaginatedResult<SimulationListItem>>(
        fetchFn,
        `${BASE}/simulations?${search}`,
        { signal },
      ),
  });
}

export function simulationOptionsQuery(fetchFn: FetchFn) {
  return queryOptions({
    queryKey: simulationKeys.options(),
    queryFn: ({ signal }) =>
      requestJson<SimulationOptions>(fetchFn, `${BASE}/simulation-options`, {
        signal,
      }),
  });
}

// How often an open simulation is read again, so calculations finished in the
// background and changes made elsewhere appear.
export const WORKSPACE_REFRESH_MS = 3000;

export function simulationWorkspaceQuery(fetchFn: FetchFn, id: string) {
  return queryOptions({
    queryKey: simulationKeys.workspace(id),
    queryFn: ({ signal }) =>
      requestJson<SimulationWorkspace>(
        fetchFn,
        `${BASE}/simulation-workspaces/${id}`,
        { signal },
      ),
  });
}

export function simulationComparisonQuery(
  fetchFn: FetchFn,
  ids: readonly string[],
) {
  return queryOptions({
    queryKey: simulationKeys.comparison(ids),
    queryFn: ({ signal }) =>
      requestJson<SimulationComparison>(
        fetchFn,
        `${BASE}/simulation-comparisons?${new URLSearchParams({ ids: ids.join(',') })}`,
        { signal },
      ),
  });
}

// Keyed by the result's instant: a result is never changed, only replaced.
export function monthlyBalancesQuery(
  fetchFn: FetchFn,
  simulationId: string,
  calculatedAt: string,
) {
  return queryOptions({
    queryKey: simulationKeys.monthlyBalances(simulationId, calculatedAt),
    queryFn: ({ signal }) =>
      requestJson<{ items: MonthlyBalance[] }>(
        fetchFn,
        `${BASE}/simulations/${simulationId}/monthly-balances`,
        { signal },
      ),
    staleTime: Infinity,
  });
}

export function createSimulation(fetchFn: FetchFn, input: SimulationInput) {
  return requestJson<{ simulationId: string }>(fetchFn, `${BASE}/simulations`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function editSimulation(
  fetchFn: FetchFn,
  id: string,
  input: SimulationInput & { readonly revision: number },
) {
  return requestJson<{ revision: number }>(
    fetchFn,
    `${BASE}/simulations/${id}`,
    { method: 'PATCH', ...jsonBody(input) },
  );
}

export function recalculateSimulation(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/simulations/${id}/recalculate`, {
    method: 'POST',
  });
}

export function deleteSimulation(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/simulations/${id}`, {
    method: 'DELETE',
  });
}
