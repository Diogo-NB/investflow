import { isCalendarDate } from './offer-values';

export function parseCalendarInput(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const calendar = `${match[3]}-${match[2]}-${match[1]}`;
  return isCalendarDate(calendar) ? calendar : undefined;
}

// Material uses local Date objects; the form and API continue to use civil-date strings.
export function calendarToPickerDate(value: string): Date | null {
  if (!isCalendarDate(value)) return null;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
  return date;
}

export function pickerDateToCalendar(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
