import { Injectable } from '@nestjs/common';
import {
  PublishedIndexSeriesNotFoundError,
  PublishedIndexSeriesRepository,
} from '@investflow/market-data-application';
import {
  EPublishedIndex,
  PublishedIndexSeries,
  PublishedIndexSeriesRevisionConflictError,
} from '@investflow/market-data-domain';
import {
  AppError,
  CalendarDate,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { PublishedIndex as PersistedIndex } from '@prisma/client';
import {
  publishedIndexSeriesInclude,
  PublishedIndexSeriesMapper,
  PublishedIndexSeriesRecord,
} from './published-index-series.mapper';

interface StoredState {
  readonly revision: number;
  readonly lastReferenceDate: CalendarDate | null;
}

@Injectable()
export class PrismaPublishedIndexSeriesRepository
  extends BaseRepository<PublishedIndexSeries>
  implements PublishedIndexSeriesRepository
{
  // What each aggregate held when it was read or last saved; a series without
  // one is new.
  private readonly storedStates = new WeakMap<
    PublishedIndexSeries,
    StoredState
  >();

  constructor(prisma: PrismaService, events: DomainEventRecorder) {
    super(prisma, events);
  }

  findById(id: string): Promise<Result<PublishedIndexSeries, AppError>> {
    return this.findOne(
      () =>
        this.prisma.client.publishedIndexSeries.findUnique({
          where: { id },
          include: publishedIndexSeriesInclude,
        }),
      { id },
    );
  }

  findByIndexAndYear(
    index: EPublishedIndex,
    year: number,
  ): Promise<Result<PublishedIndexSeries, AppError>> {
    return this.findOne(
      () =>
        this.prisma.client.publishedIndexSeries.findUnique({
          where: { index_year: { index: index as PersistedIndex, year } },
          include: publishedIndexSeriesInclude,
        }),
      { index, year },
    );
  }

  findLatest(
    index: EPublishedIndex,
  ): Promise<Result<PublishedIndexSeries, AppError>> {
    return this.findOne(
      () =>
        this.prisma.client.publishedIndexSeries.findFirst({
          where: { index: index as PersistedIndex },
          orderBy: { year: 'desc' },
          include: publishedIndexSeriesInclude,
        }),
      { index },
    );
  }

  protected async persistAggregate(
    series: PublishedIndexSeries,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedStates.get(series);
    if (stored?.revision === series.revision) return;

    if (stored) {
      const { count } = await client.publishedIndexSeries.updateMany({
        where: { id: series.id, revision: stored.revision },
        data: { revision: series.revision },
      });
      if (count === 0) {
        throw new PublishedIndexSeriesRevisionConflictError(
          series.id,
          stored.revision,
        );
      }
    } else {
      await client.publishedIndexSeries.create({
        data: PublishedIndexSeriesMapper.toPersistence(series),
      });
    }

    // Values never change, so a year's rows are not rewritten on every run.
    const storedLast = stored?.lastReferenceDate;
    await client.publishedIndexValue.createMany({
      data: series.values
        .filter(
          ({ referenceDate }) =>
            !storedLast || referenceDate.isAfter(storedLast),
        )
        .map((published) =>
          PublishedIndexSeriesMapper.valueToPersistence(series.id, published),
        ),
    });
    this.remember(series);
  }

  private async findOne(
    find: () => Promise<PublishedIndexSeriesRecord | null>,
    criteria: Readonly<Record<string, unknown>>,
  ): Promise<Result<PublishedIndexSeries, AppError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await find();
        return record ? PublishedIndexSeriesMapper.toDomain(record) : null;
      },
      (error) =>
        new RepositoryFindError(
          'PublishedIndexSeries',
          JSON.stringify(criteria),
          error,
        ),
    );
    if (result.isErr()) return result;
    if (!result.value) {
      return Result.err(new PublishedIndexSeriesNotFoundError(criteria));
    }
    this.remember(result.value);
    return Result.ok(result.value);
  }

  private remember(series: PublishedIndexSeries): void {
    this.storedStates.set(series, {
      revision: series.revision,
      lastReferenceDate: series.lastReferenceDate,
    });
  }
}
