import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OfferListState } from './offer-list-state';
import { titleTypes, TitleType } from '../models/offer.type';
import {
  formatCalendarDate,
  formatRedemption,
  formatRemuneration,
} from '../utils/offer-values';

@Component({
  selector: 'lib-offer-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './offer-list.html',
  host: { class: 'block' },
  providers: [OfferListState],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferList {
  readonly state = inject(OfferListState);
  readonly titles = titleTypes;
  readonly date = formatCalendarDate;
  readonly redemption = formatRedemption;
  readonly remuneration = formatRemuneration;
  constructor() {
    // Canonicalize a stale bookmarked page after a deletion or catalog change.
    effect(() => {
      if (this.state.outOfRange())
        void this.state.apply({ page: this.state.lastPage() });
    });
  }
  changeTitle(value: string): void {
    void this.state.apply({ titleType: value as TitleType | '' });
  }
}
