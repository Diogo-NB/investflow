import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import type { BusinessCalendar } from '../../business-calendar/business-calendar';
import {
  formatIsoDate,
  isIsoDate,
  lastDayOfMonth,
  nextDay,
  parseBrazilianMonth,
  previousDay,
} from '../../dates/calendar-date';
import {
  fitsDecimalStorage,
  isPositiveDecimal,
  parseBrazilianDecimal,
  shiftDecimal,
  toBrazilianInput,
} from '../../decimals/decimal-string';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import { isMonthly } from '../models/curve-terms';
import type {
  CurveDetail,
  CurveEdit,
  CurveInput,
  CurveInterval,
} from '../models/curve.types';

export interface IntervalRow {
  // An ISO date, or MM/AAAA for monthly indexes; the raw text while invalid.
  start: string;
  end: string;
  // Percentage in the index's unit, as typed.
  value: string;
}

export interface CurveFormValues {
  // Blank until chosen, directly or through a base curve.
  index: EconomicIndex | '';
  name: string;
  // Blank when the curve has no description.
  description: string;
  intervals: IntervalRow[];
}

export interface CurveFormContext {
  // Decides which days between intervals must have values.
  readonly calendar: BusinessCalendar;
}

export interface Coverage {
  readonly startDate: string;
  readonly endDate: string;
}

// Another row's boundary to set after the user changed this one.
export interface RowPatch {
  readonly row: number;
  readonly field: 'start' | 'end';
  readonly value: string;
}

interface DatedRange {
  readonly startDate: string;
  readonly endDate: string;
}

function monthInput(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  return `${month}/${year}`;
}

function rowRange(index: EconomicIndex | '', row: IntervalRow) {
  if (index !== '' && isMonthly(index)) {
    const start = parseBrazilianMonth(row.start);
    const end = parseBrazilianMonth(row.end);
    return {
      startDate: start && `${start}-01`,
      endDate: end && lastDayOfMonth(end),
    };
  }
  return {
    startDate: isIsoDate(row.start) ? row.start : null,
    endDate: isIsoDate(row.end) ? row.end : null,
  };
}

function datedRanges(index: EconomicIndex | '', rows: readonly IntervalRow[]) {
  return rows
    .map((row, i) => ({ i, ...rowRange(index, row) }))
    .filter(
      (range): range is DatedRange & { i: number } =>
        range.startDate !== null &&
        range.endDate !== null &&
        range.startDate <= range.endDate,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * A typed percentage as a decimal fraction ("-0,25" → "-0.0025"), or null
 * when it is not a number. Only monthly variations may be negative.
 */
function parsePercent(index: EconomicIndex, text: string): string | null {
  const trimmed = text.trim().replace('−', '-');
  const negative = trimmed.startsWith('-');
  if (negative && !isMonthly(index)) return null;
  const parsed = parseBrazilianDecimal(negative ? trimmed.slice(1) : trimmed);
  if (parsed === null) return null;
  const fraction = shiftDecimal(parsed, -2);
  return negative && isPositiveDecimal(fraction) ? `-${fraction}` : fraction;
}

function percentInput(fraction: string): string {
  const negative = fraction.startsWith('-');
  const percent = shiftDecimal(negative ? fraction.slice(1) : fraction, 2);
  return `${negative ? '-' : ''}${toBrazilianInput(percent)}`;
}

// Below -100% a monthly variation would turn the balance negative.
function isAboveMinusOneHundred(fraction: string): boolean {
  return !fraction.startsWith('-') || fraction.startsWith('-0.');
}

function validateRow(
  index: EconomicIndex,
  row: IntervalRow,
  calendar: BusinessCalendar,
  report: (field: keyof IntervalRow, message: string) => void,
) {
  const monthly = isMonthly(index);
  const range = rowRange(index, row);
  const outside = `Use datas entre ${formatIsoDate(calendar.first)} e ${formatIsoDate(calendar.last)}.`;
  const empty = monthly ? 'Informe o mês.' : 'Informe a data.';
  const invalid = monthly
    ? 'Informe um mês válido no formato MM/AAAA.'
    : 'Informe uma data válida no formato DD/MM/AAAA.';
  if (row.start.trim() === '') report('start', empty);
  else if (!range.startDate) report('start', invalid);
  else if (!calendar.contains(range.startDate)) report('start', outside);
  if (row.end.trim() === '') report('end', empty);
  else if (!range.endDate) report('end', invalid);
  else if (!calendar.contains(range.endDate)) report('end', outside);
  else if (range.startDate && range.endDate < range.startDate) {
    report('end', 'O fim deve ser igual ou posterior ao início.');
  }

  if (row.value.trim() === '') {
    report('value', monthly ? 'Informe a variação.' : 'Informe a taxa.');
    return;
  }
  const fraction = parsePercent(index, row.value);
  if (fraction === null) {
    report(
      'value',
      /^\s*[-−]/.test(row.value) && !monthly
        ? 'As taxas não podem ser negativas.'
        : 'Use apenas números, como 12,5.',
    );
  } else if (!isAboveMinusOneHundred(fraction)) {
    report('value', 'A variação deve ser maior que -100%.');
  } else if (!fitsDecimalStorage(fraction.replace('-', ''))) {
    report('value', 'Valor com casas decimais demais.');
  }
}

/**
 * The uncovered stretch between two consecutive intervals, as the API
 * reports it: every missing month, or every missing business day. Null when
 * nothing is missing.
 */
function missingBetween(
  index: EconomicIndex,
  previous: DatedRange,
  next: DatedRange,
  calendar: BusinessCalendar,
): DatedRange | null {
  const after = nextDay(previous.endDate);
  if (after >= next.startDate) return null;
  if (isMonthly(index)) {
    return { startDate: after, endDate: previousDay(next.startDate) };
  }
  const first = calendar.nextBusinessDay(previous.endDate);
  const last = calendar.previousBusinessDay(next.startDate);
  if (!first || !last || first >= next.startDate) return null;
  return { startDate: first, endDate: last };
}

export function curveFormSchema(calendar: BusinessCalendar) {
  return z
    .object({
      index: z.enum(['CDI', 'SELIC', 'IPCA', '']),
      name: z
        .string()
        .refine((value) => value.trim() !== '', 'Informe o nome da curva.')
        .refine((value) => value.length <= 100, 'Use até 100 caracteres.'),
      description: z.string().max(500, 'Use até 500 caracteres.'),
      intervals: z.array(
        z.object({ start: z.string(), end: z.string(), value: z.string() }),
      ),
    })
    .superRefine(({ index, intervals }, ctx) => {
      const report = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message });
      if (index === '') {
        report(['index'], 'Escolha o índice.');
        return;
      }
      if (intervals.length === 0) {
        report(['intervals'], 'Informe ao menos um intervalo.');
        return;
      }
      intervals.forEach((row, i) =>
        validateRow(index, row, calendar, (field, message) =>
          report(['intervals', i, field], message),
        ),
      );

      // Overlaps and gaps are reported on the later interval, in start order.
      const ranges = datedRanges(index, intervals);
      let latest: DatedRange | null = null;
      for (const range of ranges) {
        if (latest !== null && range.startDate <= latest.endDate) {
          report(
            ['intervals', range.i, 'start'],
            'Este intervalo se sobrepõe a outro.',
          );
        } else if (latest !== null) {
          const missing = missingBetween(index, latest, range, calendar);
          if (missing) {
            report(
              ['intervals', range.i, 'start'],
              missing.startDate === missing.endDate
                ? `Falta o valor de ${formatIsoDate(missing.startDate)}.`
                : `Faltam valores de ${formatIsoDate(missing.startDate)} a ${formatIsoDate(missing.endDate)}.`,
            );
          }
        }
        if (latest === null || range.endDate > latest.endDate) latest = range;
      }
    });
}

export const curveResolver: Resolver<CurveFormValues, CurveFormContext> = (
  values,
  context,
  options,
) => {
  if (!context) throw new Error('The curve form needs its calendar context');
  return zodResolver(curveFormSchema(context.calendar))(
    values,
    context,
    options,
  );
};

export function blankRow(): IntervalRow {
  return { start: '', end: '', value: '' };
}

// The first boundary after an end: the next business day, or the next month.
function startAfter(
  index: EconomicIndex,
  end: string,
  calendar: BusinessCalendar,
): string | null {
  if (isMonthly(index)) {
    const month = parseBrazilianMonth(end);
    return month ? monthInput(nextDay(lastDayOfMonth(month))) : null;
  }
  return isIsoDate(end) ? calendar.nextBusinessDay(end) : null;
}

function endBefore(
  index: EconomicIndex,
  start: string,
  calendar: BusinessCalendar,
): string | null {
  if (isMonthly(index)) {
    const month = parseBrazilianMonth(start);
    return month ? monthInput(previousDay(`${month}-01`)) : null;
  }
  return isIsoDate(start) ? calendar.previousBusinessDay(start) : null;
}

/** After an end changes, the next row starts right after it. */
export function followEnd(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
  row: number,
  calendar: BusinessCalendar,
): RowPatch | null {
  const next = rows[row + 1];
  const start = next && startAfter(index, rows[row].end, calendar);
  return start && start !== next.start
    ? { row: row + 1, field: 'start', value: start }
    : null;
}

/** After a start changes, the previous row ends right before it. */
export function followStart(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
  row: number,
  calendar: BusinessCalendar,
): RowPatch | null {
  const previous = rows[row - 1];
  const end = previous && endBefore(index, rows[row].start, calendar);
  return end && end !== previous.end
    ? { row: row - 1, field: 'end', value: end }
    : null;
}

/**
 * Before a row between two others is removed, the previous one runs until
 * the next starts, so no gap opens. Removing the first or last row shortens
 * the curve instead: stretching a neighbor would give the removed days its
 * value.
 */
export function removalPatch(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
  row: number,
  calendar: BusinessCalendar,
): RowPatch | null {
  if (row === 0 || row === rows.length - 1) return null;
  const previous = rows[row - 1];
  const end = endBefore(index, rows[row + 1].start, calendar);
  return end && end !== previous.end
    ? { row: row - 1, field: 'end', value: end }
    : null;
}

/**
 * A row split in two with the same value, at the start of the month nearest
 * its middle, or at its middle business day (month, for monthly indexes)
 * when it lies within one month. Null when it cannot be split.
 */
export function splitRow(
  index: EconomicIndex,
  row: IntervalRow,
  calendar: BusinessCalendar,
): [IntervalRow, IntervalRow] | null {
  const { startDate, endDate } = rowRange(index, row);
  if (!startDate || !endDate || startDate >= endDate) return null;

  if (isMonthly(index)) {
    const months: string[] = [];
    for (
      let month = startDate;
      month <= endDate;
      month = nextDay(lastDayOfMonth(month.slice(0, 7)))
    ) {
      months.push(month);
    }
    if (months.length < 2) return null;
    const second = months[Math.floor(months.length / 2)];
    return [
      { ...row, end: monthInput(previousDay(second)) },
      { ...row, start: monthInput(second) },
    ];
  }

  const days: string[] = [];
  for (let day = startDate; day <= endDate; day = nextDay(day)) {
    if (calendar.isBusinessDay(day)) days.push(day);
  }
  if (days.length < 2) return null;
  const middle = Math.floor(days.length / 2);
  const month = days[middle].slice(0, 7);
  const monthStarts = [
    days.findIndex((day) => day.slice(0, 7) === month),
    days.findIndex((day) => day.slice(0, 7) > month),
  ].filter((at) => at > 0);
  const at = monthStarts.length
    ? monthStarts.reduce((best, candidate) =>
        Math.abs(candidate - middle) < Math.abs(best - middle)
          ? candidate
          : best,
      )
    : middle;
  return [
    { ...row, end: days[at - 1] },
    { ...row, start: days[at] },
  ];
}

/**
 * Where a row should start to follow the rows that start before it: the day
 * (or month) after their latest end. Null when it already does, when there is
 * no earlier row, or when that start would pass its own end.
 */
export function startFix(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
  row: number,
  calendar: BusinessCalendar,
): string | null {
  const own = rowRange(index, rows[row]);
  if (!own.startDate || !own.endDate) return null;
  const ownStart = own.startDate;
  const earlierEnds = datedRanges(index, rows)
    .filter((range) => range.i !== row && range.startDate < ownStart)
    .map((range) => range.endDate)
    .sort();
  const latest = earlierEnds.at(-1);
  if (!latest) return null;
  const fixed = startAfter(
    index,
    isMonthly(index) ? monthInput(latest) : latest,
    calendar,
  );
  if (!fixed || fixed === rows[row].start) return null;
  const fixedDate = rowRange(index, { ...rows[row], start: fixed }).startDate;
  return fixedDate && fixedDate <= own.endDate ? fixed : null;
}

export interface BoundaryLimits {
  readonly min?: string;
  readonly max?: string;
}

/**
 * The days a daily row's start or end can be picked from, so that the rows
 * stay in order once their neighbors follow the change. A start stays after
 * the previous row's start and no later than its own end; an end stays no
 * earlier than its own start and before the next row's end. When neighbors
 * already disagree, the row's own other boundary wins.
 */
export function boundaryLimits(
  rows: readonly IntervalRow[],
  row: number,
  field: 'start' | 'end',
): BoundaryLimits {
  const own = rows[row];
  const dated = (iso: string | undefined) =>
    iso !== undefined && isIsoDate(iso) ? iso : undefined;
  if (field === 'start') {
    const previousStart = dated(rows[row - 1]?.start);
    const min = previousStart && nextDay(previousStart);
    const max = dated(own.end);
    return min && max && min > max ? { max } : { min, max };
  }
  const min = dated(own.start);
  const nextEnd = dated(rows[row + 1]?.end);
  const max = nextEnd && previousDay(nextEnd);
  return min && max && min > max ? { min } : { min, max };
}

/**
 * A row starting right after the last one and, as a first guess, ending with
 * that month: its last business day, or the month itself.
 */
export function nextRow(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
  calendar: BusinessCalendar,
): IntervalRow {
  const last = rows.at(-1);
  const start = last && startAfter(index, last.end, calendar);
  if (!start) return blankRow();
  if (isMonthly(index)) return { ...blankRow(), start, end: start };
  const monthEnd = calendar.previousBusinessDay(
    nextDay(lastDayOfMonth(start.slice(0, 7))),
  );
  return {
    ...blankRow(),
    start,
    end: monthEnd && monthEnd >= start ? monthEnd : start,
  };
}

/** Whether a typed daily date falls on a weekend or holiday. */
export function isNonBusinessDate(
  index: EconomicIndex,
  value: string,
  calendar: BusinessCalendar,
): boolean {
  return (
    !isMonthly(index) && isIsoDate(value) && !calendar.isBusinessDay(value)
  );
}

/** Whether any row has something typed in it. */
export function hasRowContent(rows: readonly IntervalRow[]): boolean {
  return rows.some((row) => `${row.start}${row.end}${row.value}`.trim() !== '');
}

export function blankCurveValues(
  index: EconomicIndex | '' = '',
): CurveFormValues {
  return { index, name: '', description: '', intervals: [blankRow()] };
}

export function intervalRows(
  index: EconomicIndex,
  intervals: readonly CurveInterval[],
): IntervalRow[] {
  const monthly = isMonthly(index);
  return intervals.map((interval) => ({
    start: monthly ? monthInput(interval.startDate) : interval.startDate,
    end: monthly ? monthInput(interval.endDate) : interval.endDate,
    value: percentInput(interval.value),
  }));
}

export function curveValues(curve: CurveDetail): CurveFormValues {
  return {
    index: curve.index,
    name: curve.name,
    description: curve.description ?? '',
    intervals: intervalRows(curve.index, curve.intervals),
  };
}

/** Converts validated form values into the curve's content. */
export function toCurveInput(values: CurveFormValues): CurveInput {
  const { index } = values;
  if (index === '') throw new Error('Form values must be validated first');
  const intervals = values.intervals.map((row): CurveInterval => {
    const { startDate, endDate } = rowRange(index, row);
    const value = parsePercent(index, row.value);
    if (!startDate || !endDate || value === null) {
      throw new Error('Form values must be validated first');
    }
    return { startDate, endDate, value };
  });
  return {
    index,
    name: values.name.trim(),
    description: values.description.trim() || null,
    intervals: intervals.sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}

/**
 * The fields that differ from the curve the editor started from. Both sides
 * go through the same conversion, so equal values compare equal however they
 * were typed or ordered.
 */
export function curveEdit(
  baseline: CurveDetail,
  values: CurveFormValues,
): CurveEdit {
  const before = toCurveInput(curveValues(baseline));
  const after = toCurveInput(values);
  const changed = (field: keyof CurveInput) =>
    JSON.stringify(before[field]) !== JSON.stringify(after[field]);
  return {
    revision: baseline.revision,
    ...(changed('name') ? { name: after.name } : {}),
    ...(changed('description') ? { description: after.description } : {}),
    ...(changed('intervals') ? { intervals: after.intervals } : {}),
  };
}

/** The span the rows with valid dates cover, or null while none has them. */
export function rowsCoverage(
  index: EconomicIndex,
  rows: readonly IntervalRow[],
): Coverage | null {
  const ranges = datedRanges(index, rows);
  if (ranges.length === 0) return null;
  return {
    startDate: ranges[0].startDate,
    endDate: ranges.reduce(
      (end, range) => (range.endDate > end ? range.endDate : end),
      ranges[0].endDate,
    ),
  };
}
