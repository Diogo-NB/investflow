import { Injectable } from '@nestjs/common';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { PublishedIndexValuesQueryError } from './published-index-values-query.error';

export interface LatestPublishedIndexValue {
  readonly index: 'CDI' | 'SELIC' | 'SELIC_TARGET';
  readonly referenceDate: string;
  // A fraction: 13.65% is 0.1365.
  readonly value: string;
}

// An index with nothing stored yet is absent.
export interface GetLatestPublishedIndexValuesOutput {
  readonly items: readonly LatestPublishedIndexValue[];
}

@Injectable()
export class GetLatestPublishedIndexValuesQueryHandler {
  constructor(private readonly prisma: PrismaService) {}

  // Two steps, so each value is read through the primary key and the cost does
  // not grow with the years stored.
  execute(): Promise<
    Result<GetLatestPublishedIndexValuesOutput, PublishedIndexValuesQueryError>
  > {
    return Result.fromPromise(
      async () => {
        const latestSeries =
          await this.prisma.client.publishedIndexSeries.findMany({
            distinct: ['index'],
            orderBy: [{ index: 'asc' }, { year: 'desc' }],
            select: { id: true, index: true },
          });
        const items = await Promise.all(
          latestSeries.map(async ({ id, index }) => {
            const latest =
              await this.prisma.client.publishedIndexValue.findFirstOrThrow({
                where: { seriesId: id },
                orderBy: { referenceDate: 'desc' },
                select: { referenceDate: true, value: true },
              });
            return {
              index,
              referenceDate: CalendarDate.fromUtcDate(
                latest.referenceDate,
              ).value.toIsoString(),
              value: latest.value.toFixed(),
            };
          }),
        );
        return { items };
      },
      (cause) => new PublishedIndexValuesQueryError(cause),
    );
  }
}
