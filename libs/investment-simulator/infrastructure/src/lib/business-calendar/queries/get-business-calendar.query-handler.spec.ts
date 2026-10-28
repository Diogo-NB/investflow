import { EAppErrorCode } from '@investflow/shared-domain';
import { BusinessCalendarController } from '../http/business-calendar.controller';
import { GetBusinessCalendarQueryHandler } from './get-business-calendar.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

describe('GetBusinessCalendarQueryHandler', () => {
  it('serves the weekday holidays of the years asked for', async () => {
    const controller = new BusinessCalendarController(
      new GetBusinessCalendarQueryHandler(),
    );

    const { value } = await controller.get(
      { fromYear: 2023, toYear: 2026 },
      { setHeader: jest.fn() },
    );

    expect([value.fromYear, value.toYear]).toEqual([2023, 2026]);
    expect(value.holidays).toEqual(
      expect.arrayContaining(['2026-01-01', '2026-02-16', '2026-11-20']),
    );
    // 2026-11-15 falls on a Sunday; 20/11 was not a holiday before 2024.
    expect(value.holidays).not.toContain('2026-11-15');
    expect(value.holidays).not.toContain('2023-11-20');
    expect(value.holidays[0] >= '2023-01-01').toBe(true);
    expect(value.holidays.at(-1)! <= '2026-12-31').toBe(true);
    expect([...value.holidays].sort()).toEqual(value.holidays);
  });

  it('keeps the last answer for the same years', async () => {
    const handler = new GetBusinessCalendarQueryHandler();
    const first = (await handler.execute({ fromYear: 2026, toYear: 2027 }))
      .value;

    expect(
      (await handler.execute({ fromYear: 2026, toYear: 2027 })).value,
    ).toBe(first);
    expect(
      (await handler.execute({ fromYear: 2027, toYear: 2027 })).value.fromYear,
    ).toBe(2027);
  });

  it('lets browsers keep a served calendar for a day, never a failure', async () => {
    const controller = new BusinessCalendarController(
      new GetBusinessCalendarQueryHandler(),
    );
    const served = { setHeader: jest.fn() };
    const rejected = { setHeader: jest.fn() };

    await controller.get({ fromYear: 2026, toYear: 2026 }, served);
    await controller.get({ fromYear: 2027, toYear: 2026 }, rejected);

    expect(served.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=86400',
    );
    expect(rejected.setHeader).not.toHaveBeenCalled();
  });

  it('rejects years in the wrong order', async () => {
    const handler = new GetBusinessCalendarQueryHandler();

    const result = await handler.execute({ fromYear: 2027, toYear: 2026 });

    expect(result.error.code).toBe(EAppErrorCode.INVALID_CALENDAR_DATE_RANGE);
  });
});
