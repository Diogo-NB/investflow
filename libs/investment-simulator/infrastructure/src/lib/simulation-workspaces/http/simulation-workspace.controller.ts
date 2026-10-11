import { Controller, Get, Param } from '@nestjs/common';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { SimulationIdRequest } from '../../simulations/http/requests/simulation-id.request';
import { GetSimulationOptionsQueryHandler } from '../queries/get-simulation-options.query-handler';
import { GetSimulationWorkspaceQueryHandler } from '../queries/get-simulation-workspace.query-handler';

@Controller('investment-simulator')
export class SimulationWorkspaceController {
  constructor(
    private readonly getOptions: GetSimulationOptionsQueryHandler,
    private readonly getWorkspace: GetSimulationWorkspaceQueryHandler,
  ) {}

  @Get('simulation-options')
  @SkipTransaction()
  options(@CurrentUser() user: AuthenticatedUser) {
    return this.getOptions.execute({ viewerId: user.userId });
  }

  @Get('simulation-workspaces/:simulationId')
  @SkipTransaction()
  workspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationIdRequest,
  ) {
    return this.getWorkspace.execute({ ...params, ownerId: user.userId });
  }
}
