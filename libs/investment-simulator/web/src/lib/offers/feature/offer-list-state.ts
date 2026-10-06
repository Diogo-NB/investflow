import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { OffersApi } from '../api/offers-api';
import { filterParams, readFilters } from '../utils/list-context';
import { resourceState } from '../utils/offer-errors';
import { OfferFilters } from '../models/offer.type';

@Injectable()
export class OfferListState {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly filters = computed(() => readFilters(this.query()));
  private readonly searchValue = linkedSignal(() => this.filters().q);
  readonly search = this.searchValue.asReadonly();
  private readonly resource = inject(OffersApi).list(this.filters);
  readonly view = computed(() => resourceState(this.resource));
  readonly context = computed(() => filterParams(this.filters()));
  readonly lastPage = computed(() =>
    this.resource.hasValue()
      ? Math.max(1, Math.ceil(this.resource.value().total / 20))
      : 1,
  );
  readonly outOfRange = computed(
    () => this.resource.hasValue() && this.filters().page > this.lastPage(),
  );

  async apply(changes: Partial<OfferFilters>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterParams({ ...this.filters(), page: 1, ...changes }),
    });
  }
  searchOffers(): void {
    void this.apply({ q: this.search().trim() });
  }
  setSearch(value: string): void {
    this.searchValue.set(value);
  }
  clear(): void {
    void this.apply({ q: '', titleType: '' });
  }
  retry(): void {
    if (!this.resource.isLoading()) this.resource.reload();
  }
}
