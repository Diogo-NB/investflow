import { Injectable } from '@nestjs/common';
import { CurveNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { CurveQueryError } from './curve-query.error';
import { CurveOrigin, visibleCurveWhere } from './curve-projection';

export interface GetCurveQuery {
  readonly viewerId: string;
  readonly curveId: string;
}

export interface GetCurveOutput {
  readonly id: string;
  readonly index: 'CDI' | 'SELIC' | 'IPCA';
  readonly name: string;
  readonly description: string | null;
  readonly origin: CurveOrigin;
  readonly revision: number;
  readonly intervals: readonly {
    readonly startDate: string;
    readonly endDate: string;
    readonly value: string;
  }[];
}

const curveSelect = {
  id: true,
  index: true,
  name: true,
  description: true,
  ownerId: true,
  revision: true,
  intervals: {
    select: { startDate: true, endDate: true, value: true },
    orderBy: { startDate: 'asc' },
  },
} satisfies Prisma.CurveSelect;

type CurveRecord = Prisma.CurveGetPayload<{ select: typeof curveSelect }>;

@Injectable()
export class GetCurveQueryHandler
  implements QueryHandler<GetCurveQuery, GetCurveOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetCurveQuery,
  ): Promise<Result<GetCurveOutput, CurveQueryError | CurveNotFoundError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.curve.findFirst({
          where: { id: query.curveId, ...visibleCurveWhere(query.viewerId) },
          select: curveSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new CurveQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new CurveNotFoundError(query.curveId));
  }

  private toOutput(record: CurveRecord): GetCurveOutput {
    return {
      id: record.id,
      index: record.index,
      name: record.name,
      description: record.description,
      origin: record.ownerId ? 'OWN' : 'SYSTEM',
      revision: record.revision,
      intervals: record.intervals.map((interval) => ({
        startDate: CalendarDate.fromUtcDate(
          interval.startDate,
        ).value.toIsoString(),
        endDate: CalendarDate.fromUtcDate(interval.endDate).value.toIsoString(),
        value: interval.value.toFixed(),
      })),
    };
  }
}
