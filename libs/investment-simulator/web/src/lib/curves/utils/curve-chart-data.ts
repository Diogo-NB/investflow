import {
  dayNumber,
  formatIsoDate,
  formatShortMonth,
  lastDayOfMonth,
  nextDay,
} from '../../dates/calendar-date';
import type { CurveInterval } from '../models/curve.types';

export interface CurveChartPoint {
  readonly day: number;
  // Percent, for plotting only. After the last end, the last value is drawn
  // apart (heldValue) since it holds onwards; the end carries both so the
  // two lines meet.
  readonly value: number | null;
  readonly heldValue: number | null;
  // The interval the point belongs to; the readout shows its exact value.
  readonly interval: CurveInterval;
  // Past the last end, where the last value holds.
  readonly isHeld: boolean;
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

// The first day of the month a number of months after an ISO date's month.
function monthStartAfter(iso: string, months: number): string {
  let month = iso.slice(0, 7);
  for (let i = 0; i < months; i++) {
    month = nextDay(lastDayOfMonth(month)).slice(0, 7);
  }
  return `${month}-01`;
}

/**
 * Steps of the curve's values over time. Each interval's step runs until the
 * next one starts: days between them can only be weekends and holidays,
 * which have no value of their own. The last runs to the day after its end,
 * so a single-day interval still has width, and then on, held, by a sixth
 * of the span before it, at least 31 days.
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

  const from = dayNumber(first.startDate);
  const afterEnd = dayNumber(last.endDate) + 1;
  const heldDays = Math.max(31, Math.round((afterEnd - from) / 6));
  const to = afterEnd + heldDays;

  const points: CurveChartPoint[] = [];
  sorted.forEach((interval, i) => {
    const value = Number(interval.value) * 100;
    const next = sorted[i + 1];
    const until = next
      ? dayNumber(next.startDate)
      : dayNumber(interval.endDate) + 1;
    const point = { value, heldValue: null, interval, isHeld: false };
    points.push({ ...point, day: dayNumber(interval.startDate) });
    points.push({ ...point, day: until, heldValue: next ? null : value });
    if (next) return;
    points.push({
      day: to,
      value: null,
      heldValue: value,
      interval,
      isHeld: true,
    });
  });

  let ticks = monthTicks(
    first.startDate.slice(0, 7),
    // monthTicks drops the months past `to`.
    monthStartAfter(last.endDate, Math.ceil(heldDays / 28)).slice(0, 7),
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
