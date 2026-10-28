import { dayNumber } from '../../../dates/calendar-date';
import type { CurveInterval } from '../../models/curve.types';
import { curveChartData } from '../curve-chart-data';

const october: CurveInterval = {
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  value: '0.12',
};
const november: CurveInterval = {
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  value: '0.115',
};
describe('curveChartData', () => {
  it('steps each interval up to the day after its end, then holds the last', () => {
    const data = curveChartData([november, october]);
    const point = (
      day: string,
      value: number | null,
      heldValue: number | null,
      interval: CurveInterval,
      isHeld = false,
    ) => ({ day: dayNumber(day), value, heldValue, interval, isHeld });

    expect(data?.points).toEqual([
      point('2026-10-01', 12, null, october),
      point('2026-11-01', 12, null, october),
      point('2026-11-01', 11.5, null, november),
      point('2026-12-01', 11.5, 11.5, november),
      // At least 31 days held: a sixth of 61 days is less.
      point('2027-01-01', null, 11.5, november, true),
    ]);
    expect(data?.domain).toEqual([
      dayNumber('2026-10-01'),
      dayNumber('2027-01-01'),
    ]);
    expect(data?.crossesZero).toBe(false);
  });

  it('carries a step over the weekend and holiday before the next interval', () => {
    // 10-31 and 11-01 are a weekend, 11-02 a holiday.
    const untilFriday: CurveInterval = {
      startDate: '2026-10-26',
      endDate: '2026-10-30',
      value: '0.12',
    };
    const fromTuesday: CurveInterval = {
      startDate: '2026-11-03',
      endDate: '2026-11-30',
      value: '-0.0025',
    };
    const data = curveChartData([untilFriday, fromTuesday]);

    expect(data?.points.map((point) => [point.day, point.value])).toEqual([
      [dayNumber('2026-10-26'), 12],
      [dayNumber('2026-11-03'), 12],
      [dayNumber('2026-11-03'), -0.25],
      [dayNumber('2026-12-01'), -0.25],
      [dayNumber('2027-01-01'), null],
    ]);
    expect(data?.crossesZero).toBe(true);
  });

  it('labels months for short curves and years for long ones', () => {
    expect(curveChartData([october, november])?.ticks).toEqual([
      { day: dayNumber('2026-10-01'), label: 'out/26' },
      { day: dayNumber('2026-11-01'), label: 'nov/26' },
      { day: dayNumber('2026-12-01'), label: 'dez/26' },
      { day: dayNumber('2027-01-01'), label: 'jan/27' },
    ]);

    const fiveYears = curveChartData([
      { startDate: '2024-01-01', endDate: '2028-12-31', value: '0.1365' },
    ]);
    expect(fiveYears?.ticks.map((tick) => tick.label)).toEqual([
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
      '2029',
    ]);
  });

  it('labels the first and last days of a curve shorter than a month', () => {
    const data = curveChartData([
      { startDate: '2026-10-05', endDate: '2026-10-20', value: '0.12' },
    ]);

    expect(data?.ticks.map((tick) => tick.label)).toEqual(['05/10', '20/10']);
  });

  it('has nothing to plot without intervals', () => {
    expect(curveChartData([])).toBeNull();
  });
});
