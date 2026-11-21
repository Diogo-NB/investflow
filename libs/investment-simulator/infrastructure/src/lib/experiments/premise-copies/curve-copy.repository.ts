import {
  CurveNotFoundError,
  CurveRepository,
} from '@investflow/investment-simulator-application';
import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  Result,
} from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import { CurveCopy as CurveCopyRecord, Prisma } from '@prisma/client';
import type {
  CurveCopyFields,
  CurveCopyInterval,
} from './premise-content.events';

export interface CurveCopyChange {
  readonly curveId: string;
  readonly eventId: string;
  readonly revision: number;
  readonly valuesRevision: number;
  readonly curve: CurveCopyFields;
}

// As OfferCopyRepository, for curves; reads and writes curve_copy only.
export class CurveCopyRepository extends CurveRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly isRevisionGuarded: boolean,
  ) {
    super();
  }

  async apply(change: CurveCopyChange): Promise<boolean> {
    const client = this.prisma.client;
    const stored = await client.curveCopy.findUnique({
      where: { curveId: change.curveId },
    });
    if (!stored) {
      const { index, intervals } = change.curve;
      if (!index || !intervals) {
        throw new Error(
          `No copy of curve ${change.curveId} to apply event ${change.eventId} to`,
        );
      }
      await client.curveCopy.create({
        data: {
          curveId: change.curveId,
          index,
          intervals: toJson(intervals),
          isDeleted: change.curve.isDeleted ?? false,
          revision: change.revision,
          valuesRevision: change.valuesRevision,
          lastEventId: change.eventId,
        },
      });
      return true;
    }
    if (this.isRevisionGuarded && change.revision <= stored.revision) {
      return false;
    }
    await client.curveCopy.update({
      where: { curveId: change.curveId },
      data: {
        ...(change.curve.index && { index: change.curve.index }),
        ...(change.curve.intervals && {
          intervals: toJson(change.curve.intervals),
        }),
        ...(change.curve.isDeleted !== undefined && {
          isDeleted: change.curve.isDeleted,
        }),
        revision: change.revision,
        valuesRevision: change.valuesRevision,
        lastEventId: change.eventId,
      },
    });
    return true;
  }

  async findById(
    id: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    const found = await Result.fromPromise(
      () => this.prisma.client.curveCopy.findUnique({ where: { curveId: id } }),
      (error) => new RepositoryFindError('CurveCopy', id, error),
    );
    if (found.isErr()) return found;
    if (!found.value) {
      return Result.err(
        new RepositoryFindError(
          'CurveCopy',
          id,
          new Error(`The copy of curve ${id} has no row yet`),
        ),
      );
    }
    if (found.value.isDeleted) return Result.err(new CurveNotFoundError(id));
    return Result.ok(toCurve(found.value));
  }

  findSystemCurve(): Promise<Result<Curve, RepositoryFindError>> {
    throw new Error('The curve copy is read by id only');
  }

  save(): Promise<Result<void, RepositoryFindError>> {
    throw new Error('The curve copy is written only by the curve events');
  }
}

function toJson(
  intervals: readonly CurveCopyInterval[],
): Prisma.InputJsonArray {
  return intervals.map(({ startDate, endDate, value }) => ({
    startDate,
    endDate,
    value,
  }));
}

function toCurve(record: CurveCopyRecord): Curve {
  const intervals = record.intervals as unknown as CurveCopyInterval[];
  return Curve.reconstitute({
    id: record.curveId,
    index: record.index as EEconomicIndex,
    ownerId: null,
    name: '',
    description: null,
    revision: record.revision,
    valuesRevision: record.valuesRevision,
    deletedAt: null,
    intervals: intervals.map(({ startDate, endDate, value }) =>
      CurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of(startDate),
          CalendarDate.of(endDate),
        ),
        IndexValue.of(value),
      ),
    ),
  });
}
