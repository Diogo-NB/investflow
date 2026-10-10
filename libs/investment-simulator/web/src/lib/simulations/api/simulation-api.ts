import { queryOptions } from '@tanstack/react-query';
import { jsonBody, requestJson, type FetchFn } from '../../http/request-json';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import type {
  CreateSimulationInput,
  MonthlyBalance,
  SimulationInput,
  SimulationListItem,
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';

const BASE = '/api/investment-simulator';
export const SIMULATION_PAGE_SIZE = 20;

export const simulationKeys = {
  all: ['simulations'] as const,
  lists: () => [...simulationKeys.all, 'list'] as const,
  list: (page: number) => [...simulationKeys.lists(), { page }] as const,
  options: () => [...simulationKeys.all, 'options'] as const,
  workspace: (id: string) => [...simulationKeys.all, 'workspace', id] as const,
  monthlyBalances: (calculationId: string) =>
    [...simulationKeys.all, 'monthly-balances', calculationId] as const,
};

export function simulationListQuery(fetchFn: FetchFn, page: number) {
  return queryOptions({
    queryKey: simulationKeys.list(page),
    queryFn: ({ signal }) =>
      requestJson<PaginatedResult<SimulationListItem>>(
        fetchFn,
        `${BASE}/simulations?page=${page}&pageSize=${SIMULATION_PAGE_SIZE}`,
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

// Calculations are immutable, so fetched balances never go stale.
export function monthlyBalancesQuery(fetchFn: FetchFn, calculationId: string) {
  return queryOptions({
    queryKey: simulationKeys.monthlyBalances(calculationId),
    queryFn: ({ signal }) =>
      requestJson<{ items: MonthlyBalance[] }>(
        fetchFn,
        `${BASE}/simulation-calculations/${calculationId}/monthly-balances`,
        { signal },
      ),
    staleTime: Infinity,
  });
}

export interface CalculatedSimulation {
  readonly simulationId: string;
  readonly calculationId: string;
}

export function createSimulation(
  fetchFn: FetchFn,
  input: CreateSimulationInput,
) {
  return requestJson<CalculatedSimulation>(fetchFn, `${BASE}/simulations`, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function calculateSimulation(
  fetchFn: FetchFn,
  id: string,
  input: SimulationInput,
) {
  return requestJson<CalculatedSimulation>(
    fetchFn,
    `${BASE}/simulations/${id}/calculations`,
    { method: 'POST', ...jsonBody(input) },
  );
}

export function deleteSimulation(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/simulations/${id}`, {
    method: 'DELETE',
  });
}
