import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  CalculateSimulationCommand,
  CalculateSimulationOutput,
  CalculateSimulationUseCase,
  DeleteSimulationCommand,
  DeleteSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { ListCalculationMonthlyBalancesQueryHandler } from '../queries/list-calculation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { CreateSimulationRequest } from './requests/create-simulation.request';
import { ListSimulationsRequest } from './requests/list-simulations.request';
import { SimulationCalculationIdRequest } from './requests/simulation-calculation-id.request';
import { SimulationIdRequest } from './requests/simulation-id.request';
import { SimulationInputsRequest } from './requests/simulation-inputs.request';

@Controller('investment-simulator')
export class SimulationController {
  constructor(
    private readonly calculateSimulation: CalculateSimulationUseCase,
    private readonly deleteSimulation: DeleteSimulationUseCase,
    private readonly listSimulations: ListSimulationsQueryHandler,
    private readonly listMonthlyBalances: ListCalculationMonthlyBalancesQueryHandler,
  ) {}

  @Get('simulations')
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSimulationsRequest,
  ) {
    return this.listSimulations.execute({ ...query, ownerId: user.userId });
  }

  @Post('simulations')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: CreateSimulationRequest,
  ): Promise<Result<CalculateSimulationOutput, AppError>> {
    return this.calculateSimulation.execute(
      CalculateSimulationCommand.fromCreateRequest(user.userId, request),
    );
  }

  @Post('simulations/:simulationId/calculations')
  calculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationIdRequest,
    @Body() request: SimulationInputsRequest,
  ): Promise<Result<CalculateSimulationOutput, AppError>> {
    return this.calculateSimulation.execute(
      CalculateSimulationCommand.fromRequest(user.userId, params, request),
    );
  }

  @Delete('simulations/:simulationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.deleteSimulation.execute(
      DeleteSimulationCommand.fromRequest(user.userId, params),
    );
  }

  @Get('simulation-calculations/:calculationId/monthly-balances')
  @SkipTransaction()
  monthlyBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationCalculationIdRequest,
  ) {
    return this.listMonthlyBalances.execute({
      ...params,
      ownerId: user.userId,
    });
  }
}
