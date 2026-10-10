import { Injectable } from '@nestjs/common';
import { ApplicationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { SimulationRunQueryError } from './simulation-run-query.error';
import {
  runInputsSelect,
  runSummarySelect,
  SimulationRunSummary,
  toRunSummary,
} from './simulation-run-summary.projection';

export interface ListApplicationRunsQuery {
  readonly ownerId: string;
  readonly applicationId: string;
}

export interface ListApplicationRunsOutput {
  readonly items: readonly SimulationRunSummary[];
}

@Injectable()
export class ListApplicationRunsQueryHandler
  implements QueryHandler<ListApplicationRunsQuery, ListApplicationRunsOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  // Newest first; each run states whether the application has moved on.
  async execute({
    ownerId,
    applicationId,
  }: ListApplicationRunsQuery): Promise<
    Result<
      ListApplicationRunsOutput,
      ApplicationNotFoundError | SimulationRunQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const application =
          await this.prisma.client.investmentApplication.findFirst({
            where: { id: applicationId, ownerId, deletedAt: null },
            select: {
              ...runInputsSelect,
              simulationRuns: {
                select: runSummarySelect,
                orderBy: { calculatedAt: 'desc' },
              },
            },
          });
        return application
          ? {
              items: application.simulationRuns.map((run) =>
                toRunSummary(run, application),
              ),
            }
          : null;
      },
      (cause) => new SimulationRunQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new ApplicationNotFoundError(applicationId));
  }
}
