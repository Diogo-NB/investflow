import { renderHook, waitFor } from '@testing-library/react';
import { fakeApi, harness } from '../testing/simulator-harness';
import { useNonBusinessDays } from './use-non-business-days';

const url = (year: number) =>
  `GET /api/investment-simulator/business-calendar/non-business-days?year=${year}`;

describe('useNonBusinessDays', () => {
  it('reports the API calendar of the requested year and caches it', async () => {
    const api = fakeApi({
      [url(2026)]: { year: 2026, dates: ['2026-01-01', '2026-01-03'] },
      [url(2027)]: { year: 2027, dates: ['2027-01-01'] },
    });
    const { result, rerender } = renderHook(
      ({ year }) => useNonBusinessDays(year),
      { ...harness(api), initialProps: { year: 2026 } },
    );

    expect(result.current('2026-01-01')).toBe(false);
    await waitFor(() => expect(result.current('2026-01-01')).toBe(true));
    expect(result.current('2026-01-02')).toBe(false);

    rerender({ year: 2027 });
    await waitFor(() => expect(result.current('2027-01-01')).toBe(true));
    rerender({ year: 2026 });
    expect(result.current('2026-01-03')).toBe(true);
    expect(api.calls()).toEqual([url(2026), url(2027)]);
  });
});
