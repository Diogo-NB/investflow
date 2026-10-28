import { queryOptions } from '@tanstack/react-query';
import { jsonBody, requestJson, type FetchFn } from '../../http/request-json';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import type {
  InvestmentPlanDetail,
  InvestmentPlanEdit,
  InvestmentPlanInput,
  InvestmentPlanListItem,
} from '../models/investment-plan.types';

const BASE = '/api/investment-simulator/investment-plans';
export const INVESTMENT_PLAN_PAGE_SIZE = 20;

export interface InvestmentPlanListRequest {
  readonly page: number;
  readonly pageSize?: number;
  // Only the plans this simulation belongs to.
  readonly simulationId?: string;
}

export const investmentPlanKeys = {
  all: ['investment-plans'] as const,
  lists: () => [...investmentPlanKeys.all, 'list'] as const,
  list: (request: InvestmentPlanListRequest) =>
    [...investmentPlanKeys.lists(), request] as const,
  detail: (id: string) => [...investmentPlanKeys.all, 'detail', id] as const,
};

export function investmentPlanListQuery(
  fetchFn: FetchFn,
  request: InvestmentPlanListRequest,
) {
  const search = new URLSearchParams({
    page: String(request.page),
    pageSize: String(request.pageSize ?? INVESTMENT_PLAN_PAGE_SIZE),
  });
  if (request.simulationId) search.set('simulationId', request.simulationId);
  return queryOptions({
    queryKey: investmentPlanKeys.list(request),
    queryFn: ({ signal }) =>
      requestJson<PaginatedResult<InvestmentPlanListItem>>(
        fetchFn,
        `${BASE}?${search}`,
        { signal },
      ),
  });
}

export function investmentPlanDetailQuery(fetchFn: FetchFn, id: string) {
  return queryOptions({
    queryKey: investmentPlanKeys.detail(id),
    queryFn: ({ signal }) =>
      requestJson<InvestmentPlanDetail>(fetchFn, `${BASE}/${id}`, { signal }),
  });
}

export function createInvestmentPlan(
  fetchFn: FetchFn,
  input: InvestmentPlanInput,
) {
  return requestJson<{ investmentPlanId: string }>(fetchFn, BASE, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function editInvestmentPlan(
  fetchFn: FetchFn,
  id: string,
  edit: InvestmentPlanEdit,
) {
  return requestJson<{ revision: number }>(fetchFn, `${BASE}/${id}`, {
    method: 'PATCH',
    ...jsonBody(edit),
  });
}

export function deleteInvestmentPlan(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/${id}`, { method: 'DELETE' });
}

// Safe to repeat: simulations already in the plan are ignored.
export function addInvestmentPlanSimulations(
  fetchFn: FetchFn,
  id: string,
  simulationIds: readonly string[],
) {
  return requestJson<void>(fetchFn, `${BASE}/${id}/simulations`, {
    method: 'POST',
    ...jsonBody({ simulationIds }),
  });
}

export function removeInvestmentPlanSimulation(
  fetchFn: FetchFn,
  id: string,
  simulationId: string,
) {
  return requestJson<void>(
    fetchFn,
    `${BASE}/${id}/simulations/${simulationId}`,
    { method: 'DELETE' },
  );
}
