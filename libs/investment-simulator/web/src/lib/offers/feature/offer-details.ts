import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { OfferDetailsState } from './offer-details-state';
import { Offer } from '../models/offer.type';
import {
  formatCalendarDate,
  formatRedemption,
  formatRemuneration,
} from '../utils/offer-values';

@Component({
  selector: 'lib-offer-details',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './offer-details.html',
  host: { class: 'block' },
  providers: [OfferDetailsState],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferDetails {
  readonly state = inject(OfferDetailsState);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  readonly date = formatCalendarDate;
  readonly redemption = formatRedemption;
  readonly remuneration = formatRemuneration;
  private deletionDialogOpen = false;
  async confirmDelete(offer: Offer): Promise<void> {
    if (this.deletionDialogOpen) return;
    this.deletionDialogOpen = true;
    try {
      this.state.resetDeletion();
      const { OfferDeleteDialog } = await import('../ui/offer-delete-dialog');
      const ref = this.dialog.open(OfferDeleteDialog, {
        data: { offer, state: this.state },
        width: '32rem',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'first-tabbable',
      });
      const outcome = await firstValueFrom(ref.afterClosed());
      if (!outcome) return;
      await this.router.navigate(['/ofertas'], {
        queryParams: this.state.context(),
      });
      this.snack.open(
        outcome === 'missing'
          ? 'A oferta já não estava disponível. A lista foi atualizada.'
          : 'Oferta excluída.',
        'Fechar',
        { duration: 6000 },
      );
    } finally {
      this.deletionDialogOpen = false;
    }
  }
}
