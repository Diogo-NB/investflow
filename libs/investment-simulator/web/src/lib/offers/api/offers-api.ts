import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PaginatedResult } from '../../pagination/paginated-result.type';
import {
  CreateOffer,
  Issuer,
  Offer,
  OfferFilters,
  UpdateOffer,
} from '../models/offer.type';

const base = '/api/investment-simulator';
@Injectable({ providedIn: 'root' })
export class OffersApi {
  private readonly http = inject(HttpClient);
  list(filters: () => OfferFilters) {
    return httpResource<PaginatedResult<Offer>>(() => {
      const value = filters();
      return {
        url: `${base}/offers`,
        params: {
          page: value.page,
          pageSize: 20,
          ...(value.q ? { q: value.q } : {}),
          ...(value.titleType ? { titleType: value.titleType } : {}),
        },
      };
    });
  }
  offer(id: () => string | undefined) {
    return httpResource<Offer>(() => {
      const value = id();
      return value ? `${base}/offers/${encodeURIComponent(value)}` : undefined;
    });
  }
  issuers(enabled: () => boolean = () => true) {
    return httpResource<Issuer[]>(() =>
      enabled() ? `${base}/issuers` : undefined,
    );
  }
  create(body: CreateOffer) {
    return this.http.post<{ id: string }>(`${base}/offers`, body);
  }
  update(id: string, body: UpdateOffer) {
    return this.http.patch<void>(
      `${base}/offers/${encodeURIComponent(id)}`,
      body,
    );
  }
  delete(id: string) {
    return this.http.delete<void>(`${base}/offers/${encodeURIComponent(id)}`);
  }
}
