import {
  dayNumber,
  formatIsoDate,
  formatShortMonth,
} from '../../dates/calendar-date';
import type { CurveInterval } from '../models/curve.types';

export interface CurveChartPoint {
  readonly day: number;
  // Percent, for plotting only.
  readonly value: number;
  // The interval the point belongs to; the tooltip shows its exact value.
  readonly interval: CurveInterval;
}

export interface CurveChartTick {
  readonly day: number;
  readonly label: string;
}

export interface CurveChartData {
  readonly points: readonly CurveChartPoint[];
  readonly ticks: readonly CurveChartTick[];
  readonly domain: readonly [number, number];
  // Monthly variations can be negative; the zero line marks the change.
  readonly crossesZero: boolean;
}

function monthTicks(
  firstMonth: string,
  lastMonth: string,
  from: number,
  to: number,
): CurveChartTick[] {
  let [year, month] = firstMonth.split('-').map(Number);
  const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number);
  const months: string[] = [];
  while (year < lastYear || (year === lastYear && month <= lastMonthNumber)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  const years = months.length / 12;
  // Roughly six to twelve labels, aligned to quarters or years.
  const keep = (iso: string) => {
    const m = Number(iso.slice(5, 7));
    const y = Number(iso.slice(0, 4));
    if (months.length <= 12) return true;
    if (months.length <= 36) return (m - 1) % 3 === 0;
    return m === 1 && y % Math.max(1, Math.ceil(years / 10)) === 0;
  };
  return months
    .filter(keep)
    .map((iso) => ({
      day: dayNumber(`${iso}-01`),
      label: months.length > 36 ? iso.slice(0, 4) : formatShortMonth(iso),
    }))
    .filter((tick) => tick.day >= from && tick.day <= to);
}

/**
 * Steps of the curve's values over time. Each interval's step runs until the
 * next one starts: days between them can only be weekends and holidays,
 * which have no value of their own. The last runs to the day after its end,
 * so a single-day interval still has width.
 */
export function curveChartData(
  intervals: readonly CurveInterval[],
): CurveChartData | null {
  const sorted = [...intervals].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return null;

  const points: CurveChartPoint[] = [];
  sorted.forEach((interval, i) => {
    const value = Number(interval.value) * 100;
    const next = sorted[i + 1];
    const until = next
      ? dayNumber(next.startDate)
      : dayNumber(interval.endDate) + 1;
    points.push({ day: dayNumber(interval.startDate), value, interval });
    points.push({ day: until, value, interval });
  });

  const from = dayNumber(first.startDate);
  const to = dayNumber(last.endDate) + 1;
  let ticks = monthTicks(
    first.startDate.slice(0, 7),
    last.endDate.slice(0, 7),
    from,
    to,
  );
  if (ticks.length < 2) {
    ticks = [first.startDate, last.endDate].map((iso) => ({
      day: dayNumber(iso),
      label: formatIsoDate(iso).slice(0, 5),
    }));
  }

  return {
    points,
    ticks,
    domain: [from, to],
    crossesZero: sorted.some((interval) => interval.value.startsWith('-')),
  };
}
