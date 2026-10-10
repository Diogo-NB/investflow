import { Controller, Get, Param, Post } from '@nestjs/common';
import {
  RecordSimulationRunCommand,
  RecordSimulationRunOutput,
  RecordSimulationRunUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { ApplicationIdRequest } from '../../applications/http/requests/application-id.request';
import { GetSimulationRunQueryHandler } from '../queries/get-simulation-run.query-handler';
import { ListApplicationRunsQueryHandler } from '../queries/list-application-runs.query-handler';
import { SimulationRunIdRequest } from './requests/simulation-run-id.request';

@Controller('investment-simulator')
export class SimulationRunController {
  constructor(
    private readonly recordRun: RecordSimulationRunUseCase,
    private readonly listRuns: ListApplicationRunsQueryHandler,
    private readonly getRun: GetSimulationRunQueryHandler,
  ) {}

  @Post('applications/:applicationId/runs')
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ApplicationIdRequest,
  ): Promise<Result<RecordSimulationRunOutput, AppError>> {
    return this.recordRun.execute(
      RecordSimulationRunCommand.fromRequest(user.userId, params),
    );
  }

  @Get('applications/:applicationId/runs')
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ApplicationIdRequest,
  ) {
    return this.listRuns.execute({ ...params, ownerId: user.userId });
  }

  @Get('simulation-runs/:runId')
  @SkipTransaction()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationRunIdRequest,
  ) {
    return this.getRun.execute({ ...params, ownerId: user.userId });
  }
}
