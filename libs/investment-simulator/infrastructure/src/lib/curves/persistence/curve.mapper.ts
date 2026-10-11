import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  AppError,
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  EconomicIndex as PersistedEconomicIndex,
  Prisma,
} from '@prisma/client';

export const curveInclude = {
  intervals: { orderBy: { startDate: 'asc' } },
} satisfies Prisma.CurveInclude;

export type CurveRecord = Prisma.CurveGetPayload<{
  include: typeof curveInclude;
}>;

export class CurveMapper {
  static toDomain(record: CurveRecord): Curve {
    return Curve.reconstitute({
      id: record.id,
      index: record.index as EEconomicIndex,
      ownerId: record.ownerId,
      name: record.name,
      description: record.description,
      revision: record.revision,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
      intervals: record.intervals.map((interval) =>
        CurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.fromUtcDate(interval.startDate).value,
            CalendarDate.fromUtcDate(interval.endDate).value,
          ),
          IndexValue.of(interval.value.toString()),
        ),
      ),
    });
  }

  static toPersistence(
    curve: Curve,
  ): Prisma.CurveUncheckedCreateWithoutIntervalsInput {
    return {
      id: curve.id,
      ownerId: curve.ownerId,
      index: curve.index as PersistedEconomicIndex,
      name: curve.name,
      description: curve.description,
      revision: curve.revision,
      deletedAt: curve.deletedAt?.date ?? null,
    };
  }

  static intervalsToPersistence(
    curve: Curve,
  ): Prisma.CurveIntervalCreateManyInput[] {
    return curve.intervals.map((interval) => {
      const value = interval.value.value;
      // DECIMAL(65, 30) would round silently.
      if (value.decimalPlaces() > 30 || value.abs().gte('1e35')) {
        throw new AppError(
          'O valor do índice não pode ser armazenado sem arredondamento.',
          {
            code: EAppErrorCode.CURVE_VALUE_NOT_REPRESENTABLE,
            kind: 'validation',
            metadata: { curveId: curve.id, value: value.toString() },
          },
        );
      }
      return {
        curveId: curve.id,
        startDate: interval.range.start.toUtcDate(),
        endDate: interval.range.end.toUtcDate(),
        value: value.toString(),
      };
    });
  }
}
