import { Injectable } from '@nestjs/common';
import { SimulationRunNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationRunQueryError } from './simulation-run-query.error';
import {
  isoDate,
  runInputsSelect,
  runSummarySelect,
  SimulationRunSummary,
  toRunSummary,
} from './simulation-run-summary.projection';

export interface GetSimulationRunQuery {
  readonly ownerId: string;
  readonly runId: string;
}

export interface GetSimulationRunOutput extends SimulationRunSummary {
  readonly applicationId: string;
  readonly dailyBalances: readonly {
    readonly date: string;
    readonly grossBalance: string;
    readonly dailyGrossEarnings: string;
    readonly accumulatedGrossEarnings: string;
  }[];
}

const runSelect = {
  ...runSummarySelect,
  applicationId: true,
  application: { select: runInputsSelect },
  balances: {
    select: {
      date: true,
      grossBalance: true,
      dailyGrossEarnings: true,
      accumulatedGrossEarnings: true,
    },
    orderBy: { date: 'asc' },
  },
} satisfies Prisma.SimulationRunSelect;

type RunRecord = Prisma.SimulationRunGetPayload<{ select: typeof runSelect }>;

@Injectable()
export class GetSimulationRunQueryHandler
  implements QueryHandler<GetSimulationRunQuery, GetSimulationRunOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    ownerId,
    runId,
  }: GetSimulationRunQuery): Promise<
    Result<
      GetSimulationRunOutput,
      SimulationRunNotFoundError | SimulationRunQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulationRun.findFirst({
          // Runs of deleted applications are hidden with them.
          where: { id: runId, ownerId, application: { deletedAt: null } },
          select: runSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new SimulationRunQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationRunNotFoundError(runId));
  }

  private toOutput(record: RunRecord): GetSimulationRunOutput {
    return {
      ...toRunSummary(record, record.application),
      applicationId: record.applicationId,
      dailyBalances: record.balances.map((balance) => ({
        date: isoDate(balance.date),
        grossBalance: balance.grossBalance.toFixed(),
        dailyGrossEarnings: balance.dailyGrossEarnings.toFixed(),
        accumulatedGrossEarnings: balance.accumulatedGrossEarnings.toFixed(),
      })),
    };
  }
}
