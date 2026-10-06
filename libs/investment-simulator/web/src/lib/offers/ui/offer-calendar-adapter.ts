import { Injectable } from '@angular/core';
import { NativeDateAdapter, MatDateFormats } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import {
  calendarToPickerDate,
  parseCalendarInput,
  pickerDateToCalendar,
} from '../utils/calendar-input';
import { formatCalendarDate } from '../utils/offer-values';

@Injectable()
export class OfferCalendarAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const calendar = parseCalendarInput(value);
    return calendar ? calendarToPickerDate(calendar) : this.invalid();
  }

  override format(date: Date, displayFormat: object): string {
    if ('day' in displayFormat && displayFormat.day === '2-digit') {
      return formatCalendarDate(pickerDateToCalendar(date));
    }
    return super.format(date, displayFormat);
  }
}

export const offerCalendarFormats: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};

export function offerCalendarLabels(): MatDatepickerIntl {
  const labels = new MatDatepickerIntl();
  labels.calendarLabel = 'Calendário de vencimento';
  labels.openCalendarLabel = 'Escolher data de vencimento';
  labels.closeCalendarLabel = 'Fechar calendário';
  labels.prevMonthLabel = 'Mês anterior';
  labels.nextMonthLabel = 'Próximo mês';
  labels.prevYearLabel = 'Ano anterior';
  labels.nextYearLabel = 'Próximo ano';
  labels.prevMultiYearLabel = 'Anos anteriores';
  labels.nextMultiYearLabel = 'Próximos anos';
  labels.switchToMonthViewLabel = 'Escolher mês e dia';
  labels.switchToMultiYearViewLabel = 'Escolher ano';
  labels.formatYearRangeLabel = (start, end) => `De ${start} a ${end}`;
  return labels;
}
