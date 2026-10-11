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
  CreateCurveCommand,
  CreateCurveOutput,
  CreateCurveUseCase,
  DeleteCurveCommand,
  DeleteCurveUseCase,
  DuplicateCurveCommand,
  DuplicateCurveOutput,
  DuplicateCurveUseCase,
  EditCurveCommand,
  EditCurveUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { GetCurveQueryHandler } from '../queries/get-curve.query-handler';
import { ListCurvesQueryHandler } from '../queries/list-curves.query-handler';
import { CreateCurveRequest } from './requests/create-curve.request';
import { CurveIdRequest } from './requests/curve-id.request';
import { EditCurveRequest } from './requests/edit-curve.request';
import { ListCurvesRequest } from './requests/list-curves.request';

@Controller('investment-simulator/curves')
export class CurveController {
  constructor(
    private readonly createCurve: CreateCurveUseCase,
    private readonly editCurve: EditCurveUseCase,
    private readonly duplicateCurve: DuplicateCurveUseCase,
    private readonly deleteCurve: DeleteCurveUseCase,
    private readonly listCurves: ListCurvesQueryHandler,
    private readonly getCurve: GetCurveQueryHandler,
  ) {}

  @Get()
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCurvesRequest,
  ) {
    return this.listCurves.execute({ ...query, viewerId: user.userId });
  }

  @Get(':curveId')
  @SkipTransaction()
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: CurveIdRequest) {
    return this.getCurve.execute({ ...params, viewerId: user.userId });
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: CreateCurveRequest,
  ): Promise<Result<CreateCurveOutput, AppError>> {
    return this.createCurve.execute(
      CreateCurveCommand.fromRequest(user.userId, request),
    );
  }

  @Patch(':curveId')
  @HttpCode(HttpStatus.NO_CONTENT)
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CurveIdRequest,
    @Body() request: EditCurveRequest,
  ): Promise<Result<void, AppError>> {
    return this.editCurve.execute(
      EditCurveCommand.fromRequest(user.userId, params, request),
    );
  }

  @Post(':curveId/duplicates')
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CurveIdRequest,
  ): Promise<Result<DuplicateCurveOutput, AppError>> {
    return this.duplicateCurve.execute(
      DuplicateCurveCommand.fromRequest(user.userId, params),
    );
  }

  @Delete(':curveId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CurveIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.deleteCurve.execute(
      DeleteCurveCommand.fromRequest(user.userId, params),
    );
  }
}
