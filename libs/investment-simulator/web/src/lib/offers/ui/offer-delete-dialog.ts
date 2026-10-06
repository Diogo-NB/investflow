import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Offer } from '../models/offer.type';
import { OfferDetailsState } from '../feature/offer-details-state';
import { formatCalendarDate, formatRemuneration } from '../utils/offer-values';
@Component({
  selector: 'lib-offer-delete-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './offer-delete-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDeleteDialog {
  readonly data = inject<{ offer: Offer; state: OfferDetailsState }>(
    MAT_DIALOG_DATA,
  );
  readonly ref = inject(MatDialogRef<OfferDeleteDialog>);
  readonly date = formatCalendarDate;
  readonly remuneration = formatRemuneration;
  async remove(): Promise<void> {
    this.ref.disableClose = true;
    const result = await this.data.state.remove();
    if (result) this.ref.close(result);
    else this.ref.disableClose = false;
  }
}
