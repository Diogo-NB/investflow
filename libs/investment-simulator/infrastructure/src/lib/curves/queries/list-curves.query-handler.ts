import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { CurveQueryError } from './curve-query.error';
import {
  CurveSummary,
  curveSummaryOrder,
  curveSummarySelect,
  toCurveSummary,
  visibleCurveWhere,
} from './curve-projection';

export interface ListCurvesQuery {
  readonly viewerId: string;
  readonly index?: 'CDI' | 'SELIC' | 'IPCA';
}

export type ListCurvesOutput = readonly CurveSummary[];

@Injectable()
export class ListCurvesQueryHandler
  implements QueryHandler<ListCurvesQuery, ListCurvesOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListCurvesQuery,
  ): Promise<Result<ListCurvesOutput, CurveQueryError>> {
    return Result.fromPromise(
      async () => {
        const records = await this.prisma.client.curve.findMany({
          where: {
            ...visibleCurveWhere(query.viewerId),
            ...(query.index ? { index: query.index } : {}),
          },
          select: curveSummarySelect,
          orderBy: curveSummaryOrder,
        });
        return records.map((record) => toCurveSummary(record));
      },
      (cause) => new CurveQueryError(cause),
    );
  }
}
