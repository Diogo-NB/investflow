import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateSimulationCommand,
  CreateSimulationOutput,
  CreateSimulationUseCase,
  DeleteSimulationCommand,
  DeleteSimulationUseCase,
  EditSimulationCommand,
  EditSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { ListSimulationMonthlyBalancesQueryHandler } from '../queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { CreateSimulationRequest } from './requests/create-simulation.request';
import { EditSimulationRequest } from './requests/edit-simulation.request';
import { ListSimulationsRequest } from './requests/list-simulations.request';
import { SimulationIdRequest } from './requests/simulation-id.request';

@Controller('investment-simulator')
export class SimulationController {
  constructor(
    private readonly createSimulation: CreateSimulationUseCase,
    private readonly editSimulation: EditSimulationUseCase,
    private readonly deleteSimulation: DeleteSimulationUseCase,
    private readonly listSimulations: ListSimulationsQueryHandler,
    private readonly listMonthlyBalances: ListSimulationMonthlyBalancesQueryHandler,
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
  ): Promise<Result<CreateSimulationOutput, AppError>> {
    return this.createSimulation.execute(
      CreateSimulationCommand.fromRequest(user.userId, request),
    );
  }

  @Patch('simulations/:simulationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationIdRequest,
    @Body() request: EditSimulationRequest,
  ): Promise<Result<void, AppError>> {
    return this.editSimulation.execute(
      EditSimulationCommand.fromRequest(user.userId, params, request),
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

  @Get('simulations/:simulationId/monthly-balances')
  @SkipTransaction()
  monthlyBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: SimulationIdRequest,
  ) {
    return this.listMonthlyBalances.execute({
      ...params,
      ownerId: user.userId,
    });
  }
}
