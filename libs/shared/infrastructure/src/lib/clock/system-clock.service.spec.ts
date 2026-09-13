import { SystemClock } from './system-clock.service';

describe('SystemClock', () => {
  it('returns the current time as a UTC instant', () => {
    const before = Date.now();
    const instant = new SystemClock().now();
    const after = Date.now();

    expect(instant.epochMilliseconds).toBeGreaterThanOrEqual(before);
    expect(instant.epochMilliseconds).toBeLessThanOrEqual(after);
    expect(instant.toISOString().endsWith('Z')).toBe(true);
  });

  it('returns the current calendar date in UTC', () => {
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-01-02T23:30:00-03:00'));

    expect(new SystemClock().today().toIsoString()).toBe('2026-01-03');

    now.mockRestore();
  });
});
