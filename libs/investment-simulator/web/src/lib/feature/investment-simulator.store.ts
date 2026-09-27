import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InvestmentSimulatorApi } from '../api/investment-simulator-api.service';

export type SimulatorState =
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error' };

@Injectable()
export class InvestmentSimulatorStore {
  private readonly api = inject(InvestmentSimulatorApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly writableState = signal<SimulatorState>({ kind: 'loading' });

  readonly state = this.writableState.asReadonly();

  load(): void {
    this.writableState.set({ kind: 'loading' });

    this.api
      .hello()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ message }) =>
          this.writableState.set({ kind: 'success', message }),
        error: () => this.writableState.set({ kind: 'error' }),
      });
  }

  retry(): void {
    this.load();
  }
}
