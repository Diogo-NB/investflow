import { CalendarDate, CalendarDateRange } from '@investflow/shared-domain';
import { CurveInterval } from './curve-interval.vo';
import { IndexValue } from './index-value.vo';

describe('CurveInterval', () => {
  const range = CalendarDateRange.of(
    CalendarDate.of('2026-10-01'),
    CalendarDate.of('2026-10-31'),
  );

  it('contains both endpoints and compares its range and value', () => {
    const interval = CurveInterval.create(range, IndexValue.of('0.12'));
    expect(interval.contains(range.start)).toBe(true);
    expect(interval.contains(range.end)).toBe(true);
    expect(interval.contains(CalendarDate.of('2026-11-01'))).toBe(false);
    expect(
      interval.equals(CurveInterval.create(range, IndexValue.of('0.120'))),
    ).toBe(true);
    expect(
      interval.equals(CurveInterval.create(range, IndexValue.of('0.11'))),
    ).toBe(false);
    expect(
      interval.equals(
        CurveInterval.create(
          CalendarDateRange.of(range.start, range.start),
          interval.value,
        ),
      ),
    ).toBe(false);
  });
});
