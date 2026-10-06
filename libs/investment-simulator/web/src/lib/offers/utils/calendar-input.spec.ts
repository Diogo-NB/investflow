import {
  calendarToPickerDate,
  parseCalendarInput,
  pickerDateToCalendar,
} from './calendar-input';

describe('calendar input boundary', () => {
  it.each([
    '2028-02-29',
    '2033-12-31',
    '0001-01-01',
    '0099-12-31',
    '9999-12-31',
    '2026-03-08',
    '2026-11-01',
  ])(
    'round-trips %s through local calendar components without changing the day',
    (value) => {
      const date = calendarToPickerDate(value);
      expect(pickerDateToCalendar(date)).toBe(value);
      expect(date?.getHours()).toBe(0);
    },
  );
  it('parses Brazilian dates strictly, including leap-year rules', () => {
    expect(parseCalendarInput(' 29/02/2028 ')).toBe('2028-02-29');
    expect(parseCalendarInput('01/01/0001')).toBe('0001-01-01');
    for (const value of [
      '29/02/2027',
      '31/04/2028',
      '00/01/2028',
      '01/01/0000',
      '12/31/2033',
      '1/1/2033',
      'invalid',
    ]) {
      expect(parseCalendarInput(value)).toBeUndefined();
    }
  });
  it('rejects invalid calendar/adapter values without rolling over into another day', () => {
    expect(calendarToPickerDate('2028-02-30')).toBeNull();
    expect(calendarToPickerDate('')).toBeNull();
    expect(pickerDateToCalendar(null)).toBe('');
    expect(pickerDateToCalendar(new Date(NaN))).toBe('');
  });
});
