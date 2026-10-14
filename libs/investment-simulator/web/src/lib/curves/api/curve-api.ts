import { queryOptions } from '@tanstack/react-query';
import { jsonBody, requestJson, type FetchFn } from '../../http/request-json';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import type {
  CurveDetail,
  CurveEdit,
  CurveInput,
  CurveSummary,
} from '../models/curve.types';

const BASE = '/api/investment-simulator/curves';

export interface CurveListRequest {
  readonly index?: EconomicIndex;
}

export const curveKeys = {
  all: ['curves'] as const,
  lists: () => [...curveKeys.all, 'list'] as const,
  list: (request: CurveListRequest) => [...curveKeys.lists(), request] as const,
  detail: (id: string) => [...curveKeys.all, 'detail', id] as const,
};

export function curveListQuery(fetchFn: FetchFn, request: CurveListRequest) {
  const search = request.index ? `?index=${request.index}` : '';
  return queryOptions({
    queryKey: curveKeys.list(request),
    queryFn: ({ signal }) =>
      requestJson<CurveSummary[]>(fetchFn, `${BASE}${search}`, { signal }),
  });
}

export function curveDetailQuery(fetchFn: FetchFn, id: string) {
  return queryOptions({
    queryKey: curveKeys.detail(id),
    queryFn: ({ signal }) =>
      requestJson<CurveDetail>(fetchFn, `${BASE}/${id}`, { signal }),
  });
}

export function createCurve(fetchFn: FetchFn, input: CurveInput) {
  return requestJson<{ curveId: string }>(fetchFn, BASE, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function editCurve(fetchFn: FetchFn, id: string, edit: CurveEdit) {
  return requestJson<void>(fetchFn, `${BASE}/${id}`, {
    method: 'PATCH',
    ...jsonBody(edit),
  });
}

export function duplicateCurve(fetchFn: FetchFn, id: string) {
  return requestJson<{ curveId: string }>(fetchFn, `${BASE}/${id}/duplicates`, {
    method: 'POST',
  });
}

export function deleteCurve(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/${id}`, { method: 'DELETE' });
}
