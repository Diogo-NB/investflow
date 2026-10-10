import { BrazilianBusinessDayCalendar } from '@investflow/shared-domain';
import { BusinessCalendarController } from '../http/business-calendar.controller';
import { ListNonBusinessDaysQueryHandler } from './list-non-business-days.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

describe('ListNonBusinessDaysQueryHandler', () => {
  it("lists the calendar's weekends and holidays of a year", async () => {
    const controller = new BusinessCalendarController(
      new ListNonBusinessDaysQueryHandler(new BrazilianBusinessDayCalendar()),
    );

    const { value } = await controller.nonBusinessDays({ year: 2026 });

    expect(value.year).toBe(2026);
    expect(value.dates[0]).toBe('2026-01-01');
    expect(value.dates).toEqual(
      expect.arrayContaining([
        '2026-01-03',
        '2026-02-16',
        '2026-02-17',
        '2026-12-25',
      ]),
    );
    expect(value.dates).not.toContain('2026-01-02');
    expect([...value.dates].sort()).toEqual(value.dates);
  });
});
