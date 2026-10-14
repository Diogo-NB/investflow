import { queryOptions } from '@tanstack/react-query';
import { jsonBody, requestJson, type FetchFn } from '../../http/request-json';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import type { TitleType } from '../models/offer-terms';
import type {
  ContentOrigin,
  OfferEdit,
  OfferSummary,
  OfferTermsInput,
} from '../models/offer.types';

const BASE = '/api/investment-simulator/offers';
export const OFFER_PAGE_SIZE = 20;

export interface OfferListRequest {
  readonly page: number;
  readonly q?: string;
  readonly titleType?: TitleType;
  readonly origin?: ContentOrigin;
}

export const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (request: OfferListRequest) => [...offerKeys.lists(), request] as const,
  detail: (id: string) => [...offerKeys.all, 'detail', id] as const,
};

export function offerListQuery(fetchFn: FetchFn, request: OfferListRequest) {
  const search = new URLSearchParams({
    page: String(request.page),
    pageSize: String(OFFER_PAGE_SIZE),
  });
  if (request.q) search.set('q', request.q);
  if (request.titleType) search.set('titleType', request.titleType);
  if (request.origin) search.set('origin', request.origin);
  return queryOptions({
    queryKey: offerKeys.list(request),
    queryFn: ({ signal }) =>
      requestJson<PaginatedResult<OfferSummary>>(fetchFn, `${BASE}?${search}`, {
        signal,
      }),
  });
}

export function offerDetailQuery(fetchFn: FetchFn, id: string) {
  return queryOptions({
    queryKey: offerKeys.detail(id),
    queryFn: ({ signal }) =>
      requestJson<OfferSummary>(fetchFn, `${BASE}/${id}`, { signal }),
  });
}

export function createOffer(fetchFn: FetchFn, input: OfferTermsInput) {
  return requestJson<{ offerId: string }>(fetchFn, BASE, {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function editOffer(fetchFn: FetchFn, id: string, edit: OfferEdit) {
  return requestJson<void>(fetchFn, `${BASE}/${id}`, {
    method: 'PATCH',
    ...jsonBody(edit),
  });
}

export function duplicateOffer(fetchFn: FetchFn, id: string) {
  return requestJson<{ offerId: string }>(fetchFn, `${BASE}/${id}/duplicates`, {
    method: 'POST',
  });
}

export function deleteOffer(fetchFn: FetchFn, id: string) {
  return requestJson<void>(fetchFn, `${BASE}/${id}`, { method: 'DELETE' });
}
