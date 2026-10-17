import { Controller, Get, Query } from '@nestjs/common';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { GetSimulationComparisonQueryHandler } from '../queries/get-simulation-comparison.query-handler';
import { SimulationComparisonRequest } from './requests/simulation-comparison.request';

@Controller('investment-simulator')
export class SimulationComparisonController {
  constructor(
    private readonly getComparison: GetSimulationComparisonQueryHandler,
  ) {}

  @Get('simulation-comparisons')
  @SkipTransaction()
  comparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query() request: SimulationComparisonRequest,
  ) {
    return this.getComparison.execute({ ...request, ownerId: user.userId });
  }
}
