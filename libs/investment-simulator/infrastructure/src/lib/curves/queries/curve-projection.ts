import { CalendarDate } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

// Shared by the curve list and the simulation options, which show curves the
// same way.

export type CurveOrigin = 'SYSTEM' | 'OWN';

export interface CurveSummary {
  readonly id: string;
  readonly index: 'CDI' | 'SELIC' | 'IPCA';
  readonly name: string;
  readonly description: string | null;
  readonly origin: CurveOrigin;
  readonly revision: number;
  // First and last covered dates.
  readonly coverage: { readonly startDate: string; readonly endDate: string };
  // Uncovered days between the first and last dates; they block only the
  // calculations that need them.
  readonly hasGaps: boolean;
}

// A user sees system curves and their own.
export function visibleCurveWhere(viewerId: string): Prisma.CurveWhereInput {
  return { deletedAt: null, OR: [{ ownerId: null }, { ownerId: viewerId }] };
}

export const curveSummarySelect = {
  id: true,
  index: true,
  name: true,
  description: true,
  ownerId: true,
  revision: true,
  intervals: {
    select: { startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  },
} satisfies Prisma.CurveSelect;

// System curves first, then the user's, each by name.
export const curveSummaryOrder: Prisma.CurveOrderByWithRelationInput[] = [
  { index: 'asc' },
  { ownerId: { sort: 'asc', nulls: 'first' } },
  { name: 'asc' },
  { id: 'asc' },
];

type CurveSummaryRecord = Prisma.CurveGetPayload<{
  select: typeof curveSummarySelect;
}>;

export function toCurveSummary(record: CurveSummaryRecord): CurveSummary {
  const intervals = record.intervals.map((interval) => ({
    start: CalendarDate.fromUtcDate(interval.startDate).value,
    end: CalendarDate.fromUtcDate(interval.endDate).value,
  }));
  return {
    id: record.id,
    index: record.index,
    name: record.name,
    description: record.description,
    origin: record.ownerId ? 'OWN' : 'SYSTEM',
    revision: record.revision,
    coverage: {
      startDate: intervals[0].start.toIsoString(),
      endDate: intervals[intervals.length - 1].end.toIsoString(),
    },
    hasGaps: intervals.some(
      (interval, i) =>
        i > 0 && !intervals[i - 1].end.addDays(1).equals(interval.start),
    ),
  };
}
