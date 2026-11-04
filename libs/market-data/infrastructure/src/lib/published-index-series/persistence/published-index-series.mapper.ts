import {
  EPublishedIndex,
  PublishedIndexSeries,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { Prisma, PublishedIndex as PersistedIndex } from '@prisma/client';
import Decimal from 'decimal.js';

export const publishedIndexSeriesInclude = {
  values: { orderBy: { referenceDate: 'asc' } },
} satisfies Prisma.PublishedIndexSeriesInclude;

export type PublishedIndexSeriesRecord = Prisma.PublishedIndexSeriesGetPayload<{
  include: typeof publishedIndexSeriesInclude;
}>;

export class PublishedIndexSeriesMapper {
  static toDomain(record: PublishedIndexSeriesRecord): PublishedIndexSeries {
    return PublishedIndexSeries.reconstitute({
      id: record.id,
      index: record.index as EPublishedIndex,
      year: record.year,
      revision: record.revision,
      values: record.values.map((stored) =>
        PublishedIndexValue.of(
          CalendarDate.fromUtcDate(stored.referenceDate).value,
          new Decimal(stored.value.toString()),
        ),
      ),
    });
  }

  static toPersistence(
    series: PublishedIndexSeries,
  ): Prisma.PublishedIndexSeriesUncheckedCreateWithoutValuesInput {
    return {
      id: series.id,
      index: series.index as PersistedIndex,
      year: series.year,
      revision: series.revision,
    };
  }

  static valueToPersistence(
    seriesId: string,
    published: PublishedIndexValue,
  ): Prisma.PublishedIndexValueCreateManyInput {
    return {
      seriesId,
      referenceDate: published.referenceDate.toUtcDate(),
      value: published.value.toFixed(),
    };
  }
}
