import { validate } from 'class-validator';
import {
  IS_CALENDAR_DATE,
  IsCalendarDate,
  isCalendarDate,
} from './calendar-date.validator';

class CalendarDateRequest {
  @IsCalendarDate()
  value!: string;
}

describe('IsCalendarDate', () => {
  it.each(['2026-09-28', '2000-02-29', '0001-01-01'])(
    'accepts valid civil date %s',
    (value) => {
      expect(isCalendarDate(value)).toBe(true);
    },
  );

  it.each([
    '2026-02-29',
    '2026-09-31',
    '28/09/2026',
    '2026-09-28T12:00:00Z',
    '',
    20260928,
    null,
  ])('rejects invalid calendar date %p', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it('provides a class-validator decorator', async () => {
    const request = new CalendarDateRequest();
    request.value = '2026-02-29';

    const errors = await validate(request);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.[IS_CALENDAR_DATE]).toBe(
      'value must be a valid calendar date in YYYY-MM-DD format',
    );
  });
});
