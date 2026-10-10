import {
  EEconomicIndex,
  IndexCurve,
  IndexCurveInterval,
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

export type IndexCurveRecord = Prisma.IndexCurveGetPayload<{
  include: { intervals: true };
}>;

export class IndexCurveMapper {
  static toDomain(record: IndexCurveRecord): IndexCurve {
    return IndexCurve.reconstitute({
      id: record.id,
      name: record.name,
      description: record.description,
      index: record.index as EEconomicIndex,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
      intervals: record.intervals.map((interval) =>
        IndexCurveInterval.create(
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
    curve: IndexCurve,
  ): Prisma.IndexCurveUncheckedCreateInput {
    return {
      id: curve.id,
      name: curve.name,
      description: curve.description,
      index: curve.index as PersistedEconomicIndex,
      deletedAt: curve.deletedAt?.date ?? null,
      intervals: {
        create: curve.intervals.map((interval) => {
          const value = interval.value.value;
          if (value.decimalPlaces() > 30 || value.abs().gte('1e35')) {
            throw new AppError(
              'O valor do índice não pode ser armazenado sem arredondamento.',
              {
                code: EAppErrorCode.INDEX_CURVE_VALUE_NOT_REPRESENTABLE,
                kind: 'validation',
                metadata: { curveId: curve.id, value: value.toString() },
              },
            );
          }
          return {
            startDate: interval.range.start.toUtcDate(),
            endDate: interval.range.end.toUtcDate(),
            value: value.toString(),
          };
        }),
      },
    };
  }
}
