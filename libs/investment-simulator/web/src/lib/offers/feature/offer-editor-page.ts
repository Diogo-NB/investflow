import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { OffersApi } from '../api/offers-api';
import { OfferForm } from '../ui/offer-form';
import { resourceState } from '../utils/offer-errors';
import { filterParams, readFilters } from '../utils/list-context';
@Component({
  selector: 'lib-offer-editor-page',
  imports: [RouterLink, MatButtonModule, OfferForm],
  templateUrl: './offer-editor-page.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly api = inject(OffersApi);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly id = computed(() => this.params().get('offerId') ?? undefined);
  readonly editing = computed(() => !!this.id());
  private readonly offer = this.api.offer(this.id);
  private readonly issuers = this.api.issuers(() => !this.editing());
  readonly offerView = computed(() => resourceState(this.offer));
  readonly issuerView = computed(() => resourceState(this.issuers));
  readonly context = computed(() => filterParams(readFilters(this.query())));
  readonly form = viewChild(OfferForm);
  private pendingConfirmation?: Promise<boolean>;
  async canLeave(): Promise<boolean> {
    const state = this.form()?.state;
    if (state?.pending()) return false;
    if (!state?.dirty()) return true;
    if (this.pendingConfirmation) return this.pendingConfirmation;
    this.pendingConfirmation = this.confirmDiscard();
    try {
      return await this.pendingConfirmation;
    } finally {
      this.pendingConfirmation = undefined;
    }
  }
  private async confirmDiscard(): Promise<boolean> {
    const { DiscardChangesDialog } = await import(
      '../ui/discard-changes-dialog'
    );
    return (
      (await firstValueFrom(
        this.dialog
          .open(DiscardChangesDialog, {
            width: '30rem',
            maxWidth: 'calc(100vw - 32px)',
            autoFocus: 'first-tabbable',
          })
          .afterClosed(),
      )) === true
    );
  }
  cancel(): void {
    void this.router.navigate(
      this.id() ? ['/ofertas', this.id()] : ['/ofertas'],
      { queryParams: this.context() },
    );
  }
  async saved(id: string): Promise<void> {
    const navigated = await this.router.navigate(['/ofertas', id], {
      queryParams: this.context(),
    });
    if (navigated)
      this.snack.open(
        this.editing() ? 'Alterações salvas.' : 'Oferta criada.',
        'Fechar',
        { duration: 6000 },
      );
  }
  retry(): void {
    const resource = this.editing() ? this.offer : this.issuers;
    if (!resource.isLoading()) resource.reload();
  }
}
