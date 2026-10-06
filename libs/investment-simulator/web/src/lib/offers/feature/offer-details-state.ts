import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { OffersApi } from '../api/offers-api';
import { OperationState } from '../models/offer.type';
import { filterParams, readFilters } from '../utils/list-context';
import { offerError, resourceState } from '../utils/offer-errors';

@Injectable()
export class OfferDetailsState {
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly api = inject(OffersApi);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly id = computed(() => this.params().get('offerId') ?? undefined);
  private readonly resource = this.api.offer(this.id);
  readonly view = computed(() => resourceState(this.resource));
  readonly context = computed(() => filterParams(readFilters(this.query())));
  private readonly operationState = signal<OperationState>({ status: 'idle' });
  readonly operation = this.operationState.asReadonly();
  retry(): void {
    if (!this.resource.isLoading()) this.resource.reload();
  }
  resetDeletion(): void {
    if (this.operation().status !== 'pending')
      this.operationState.set({ status: 'idle' });
  }

  async remove(): Promise<'deleted' | 'missing' | undefined> {
    const id = this.id();
    if (!id || this.operation().status === 'pending') return undefined;
    this.operationState.set({ status: 'pending' });
    try {
      await firstValueFrom(
        this.api.delete(id).pipe(takeUntilDestroyed(this.destroy)),
      );
      this.operationState.set({ status: 'success' });
      return 'deleted';
    } catch (error: unknown) {
      if (this.destroy.destroyed) return undefined;
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.operationState.set({ status: 'success' });
        return 'missing';
      }
      this.operationState.set({
        status: 'error',
        message: offerError(error, 'delete'),
      });
      return undefined;
    }
  }
}
