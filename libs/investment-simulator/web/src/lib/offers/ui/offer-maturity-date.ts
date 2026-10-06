import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  DateAdapter,
  ErrorStateMatcher,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import {
  MatDatepickerIntl,
  MatDatepickerModule,
} from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  calendarToPickerDate,
  parseCalendarInput,
  pickerDateToCalendar,
} from '../utils/calendar-input';
import {
  OfferCalendarAdapter,
  offerCalendarFormats,
  offerCalendarLabels,
} from './offer-calendar-adapter';

@Component({
  selector: 'lib-offer-maturity-date',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
  ],
  templateUrl: './offer-maturity-date.html',
  host: { class: 'block min-w-0' },
  providers: [
    { provide: DateAdapter, useClass: OfferCalendarAdapter },
    { provide: MAT_DATE_FORMATS, useValue: offerCalendarFormats },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MatDatepickerIntl, useFactory: offerCalendarLabels },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferMaturityDate implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly touched = model(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly control = new FormControl<Date | null>(null);
  private readonly inputElement =
    viewChild<ElementRef<HTMLInputElement>>('dateInput');
  readonly errorMatcher: ErrorStateMatcher = {
    isErrorState: () => this.touched() && this.invalid(),
  };

  constructor() {
    effect(() => {
      const value = this.value();
      const date = calendarToPickerDate(value);
      // Do not reformat partially typed/invalid text while the user is editing.
      if (
        (date || !value) &&
        pickerDateToCalendar(this.control.value) !== value
      ) {
        this.control.setValue(date, { emitEvent: false });
      }
    });
    effect(() => {
      if (this.disabled()) this.control.disable({ emitEvent: false });
      else this.control.enable({ emitEvent: false });
    });
  }

  selectDate(date: Date | null, text: string): void {
    this.value.set(date ? pickerDateToCalendar(date) : text.trim());
  }

  typeDate(text: string): void {
    this.value.set(parseCalendarInput(text) ?? text.trim());
  }

  focus(options?: FocusOptions): void {
    this.inputElement()?.nativeElement.focus(options);
  }
}
