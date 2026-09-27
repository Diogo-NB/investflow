import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InvestmentSimulatorStore } from './investment-simulator.store';

@Component({
  selector: 'lib-investment-simulator-page',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './investment-simulator-page.component.html',
  host: { class: 'block min-h-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [InvestmentSimulatorStore],
})
export class InvestmentSimulatorPage {
  readonly store = inject(InvestmentSimulatorStore);
  readonly state = this.store.state;

  constructor() {
    this.store.load();
  }

  retry(): void {
    this.store.retry();
  }
}
