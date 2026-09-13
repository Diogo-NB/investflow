import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InvestmentSimulatorApi } from '../api/investment-simulator-api.service';

type SimulatorState =
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error' };

@Component({
  selector: 'lib-investment-simulator-page',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './investment-simulator-page.component.html',
  styleUrl: './investment-simulator-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvestmentSimulatorPage {
  private readonly api = inject(InvestmentSimulatorApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<SimulatorState>({ kind: 'loading' });

  constructor() {
    this.loadGreeting();
  }

  protected retry(): void {
    this.loadGreeting();
  }

  private loadGreeting(): void {
    this.state.set({ kind: 'loading' });

    this.api
      .hello()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ message }) => this.state.set({ kind: 'success', message }),
        error: () => this.state.set({ kind: 'error' }),
      });
  }
}
