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
  AddInvestmentPlanSimulationsCommand,
  AddInvestmentPlanSimulationsUseCase,
  CreateInvestmentPlanCommand,
  CreateInvestmentPlanOutput,
  CreateInvestmentPlanUseCase,
  DeleteInvestmentPlanCommand,
  DeleteInvestmentPlanUseCase,
  EditInvestmentPlanCommand,
  EditInvestmentPlanOutput,
  EditInvestmentPlanUseCase,
  RemoveInvestmentPlanSimulationCommand,
  RemoveInvestmentPlanSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { GetInvestmentPlanQueryHandler } from '../queries/get-investment-plan.query-handler';
import { ListInvestmentPlansQueryHandler } from '../queries/list-investment-plans.query-handler';
import { AddInvestmentPlanSimulationsRequest } from './requests/add-investment-plan-simulations.request';
import { CreateInvestmentPlanRequest } from './requests/create-investment-plan.request';
import { EditInvestmentPlanRequest } from './requests/edit-investment-plan.request';
import { InvestmentPlanIdRequest } from './requests/investment-plan-id.request';
import { InvestmentPlanSimulationIdRequest } from './requests/investment-plan-simulation-id.request';
import { ListInvestmentPlansRequest } from './requests/list-investment-plans.request';

@Controller('investment-simulator')
export class InvestmentPlanController {
  constructor(
    private readonly createInvestmentPlan: CreateInvestmentPlanUseCase,
    private readonly editInvestmentPlan: EditInvestmentPlanUseCase,
    private readonly deleteInvestmentPlan: DeleteInvestmentPlanUseCase,
    private readonly addSimulations: AddInvestmentPlanSimulationsUseCase,
    private readonly removeSimulation: RemoveInvestmentPlanSimulationUseCase,
    private readonly listInvestmentPlans: ListInvestmentPlansQueryHandler,
    private readonly getInvestmentPlan: GetInvestmentPlanQueryHandler,
  ) {}

  @Get('investment-plans')
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInvestmentPlansRequest,
  ) {
    return this.listInvestmentPlans.execute({ ...query, ownerId: user.userId });
  }

  @Get('investment-plans/:investmentPlanId')
  @SkipTransaction()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: InvestmentPlanIdRequest,
  ) {
    return this.getInvestmentPlan.execute({ ...params, ownerId: user.userId });
  }

  @Post('investment-plans')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: CreateInvestmentPlanRequest,
  ): Promise<Result<CreateInvestmentPlanOutput, AppError>> {
    return this.createInvestmentPlan.execute(
      CreateInvestmentPlanCommand.fromRequest(user.userId, request),
    );
  }

  // Answers the saved revision, which the next edit must send.
  @Patch('investment-plans/:investmentPlanId')
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: InvestmentPlanIdRequest,
    @Body() request: EditInvestmentPlanRequest,
  ): Promise<Result<EditInvestmentPlanOutput, AppError>> {
    return this.editInvestmentPlan.execute(
      EditInvestmentPlanCommand.fromRequest(user.userId, params, request),
    );
  }

  @Delete('investment-plans/:investmentPlanId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: InvestmentPlanIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.deleteInvestmentPlan.execute(
      DeleteInvestmentPlanCommand.fromRequest(user.userId, params),
    );
  }

  // Safe to repeat: simulations already in the plan are ignored.
  @Post('investment-plans/:investmentPlanId/simulations')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: InvestmentPlanIdRequest,
    @Body() request: AddInvestmentPlanSimulationsRequest,
  ): Promise<Result<void, AppError>> {
    return this.addSimulations.execute(
      AddInvestmentPlanSimulationsCommand.fromRequest(
        user.userId,
        params,
        request,
      ),
    );
  }

  // Safe to repeat: removing a simulation outside the plan changes nothing.
  @Delete('investment-plans/:investmentPlanId/simulations/:simulationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: InvestmentPlanSimulationIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.removeSimulation.execute(
      RemoveInvestmentPlanSimulationCommand.fromRequest(user.userId, params),
    );
  }
}
