import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OfferMaturityDate } from './offer-maturity-date';
import { OfferEditorState } from '../feature/offer-editor-state';
import {
  Issuer,
  Offer,
  OfferFormModel,
  RemunerationKind,
  titleTypes,
} from '../models/offer.type';
import { redemptionOptions, remunerationOptions } from '../utils/offer-values';
@Component({
  selector: 'lib-offer-form',
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    OfferMaturityDate,
  ],
  providers: [OfferEditorState],
  templateUrl: './offer-form.html',
  host: { class: 'block', '(window:beforeunload)': 'beforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferForm implements OnInit {
  readonly offer = input<Offer>();
  readonly issuers = input<readonly Issuer[]>([]);
  readonly saved = output<string>();
  readonly canceled = output<void>();
  readonly state = inject(OfferEditorState);
  readonly titles = titleTypes;
  readonly redemptions = redemptionOptions;
  readonly remunerations = remunerationOptions;
  ngOnInit(): void {
    this.state.initialize(this.offer());
  }
  errorFor(key: keyof OfferFormModel): string | undefined {
    const field = this.state.form[key]();
    return field.touched() ? field.errors()[0]?.message : undefined;
  }
  changeRemuneration(value: string): void {
    this.state.changeRemuneration(value as RemunerationKind | '');
  }
  async save(): Promise<void> {
    const id = await this.state.save();
    if (id) this.saved.emit(id);
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.state.dirty() || this.state.pending()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
