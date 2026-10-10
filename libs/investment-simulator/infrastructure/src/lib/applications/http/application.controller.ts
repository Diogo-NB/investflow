import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CreateApplicationCommand,
  CreateApplicationOutput,
  CreateApplicationUseCase,
  DeleteApplicationCommand,
  DeleteApplicationUseCase,
  ReviseApplicationCommand,
  ReviseApplicationUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { GetApplicationQueryHandler } from '../queries/get-application.query-handler';
import { ListApplicationsQueryHandler } from '../queries/list-applications.query-handler';
import { ApplicationIdRequest } from './requests/application-id.request';
import { CreateApplicationRequest } from './requests/create-application.request';
import { ListApplicationsRequest } from './requests/list-applications.request';
import { ReviseApplicationRequest } from './requests/revise-application.request';

@Controller('investment-simulator/applications')
export class ApplicationController {
  constructor(
    private readonly createApplication: CreateApplicationUseCase,
    private readonly reviseApplication: ReviseApplicationUseCase,
    private readonly deleteApplication: DeleteApplicationUseCase,
    private readonly listApplications: ListApplicationsQueryHandler,
    private readonly getApplication: GetApplicationQueryHandler,
  ) {}

  @Get()
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsRequest,
  ) {
    return this.listApplications.execute({ ...query, ownerId: user.userId });
  }

  @Get(':applicationId')
  @SkipTransaction()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ApplicationIdRequest,
  ) {
    return this.getApplication.execute({ ...params, ownerId: user.userId });
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: CreateApplicationRequest,
  ): Promise<Result<CreateApplicationOutput, AppError>> {
    return this.createApplication.execute(
      CreateApplicationCommand.fromRequest(user.userId, request),
    );
  }

  @Put(':applicationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revise(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ApplicationIdRequest,
    @Body() request: ReviseApplicationRequest,
  ): Promise<Result<void, AppError>> {
    return this.reviseApplication.execute(
      ReviseApplicationCommand.fromRequest(user.userId, params, request),
    );
  }

  @Delete(':applicationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ApplicationIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.deleteApplication.execute(
      DeleteApplicationCommand.fromRequest(user.userId, params),
    );
  }
}
