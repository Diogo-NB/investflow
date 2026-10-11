import { Module } from '@nestjs/common';
import {
  CreateCurveUseCase,
  CurveRepository,
  DeleteCurveUseCase,
  DuplicateCurveUseCase,
  EditCurveUseCase,
} from '@investflow/investment-simulator-application';
import { CurveController } from './http/curve.controller';
import { PrismaCurveRepository } from './persistence/prisma-curve.repository';
import { GetCurveQueryHandler } from './queries/get-curve.query-handler';
import { ListCurvesQueryHandler } from './queries/list-curves.query-handler';

// Needs Clock and PrismaService from the host. Seed and import processes use
// it without HTTP to write system curves through the use cases.
@Module({
  controllers: [CurveController],
  providers: [
    { provide: CurveRepository, useClass: PrismaCurveRepository },
    CreateCurveUseCase,
    EditCurveUseCase,
    DuplicateCurveUseCase,
    DeleteCurveUseCase,
    ListCurvesQueryHandler,
    GetCurveQueryHandler,
  ],
  exports: [CurveRepository, CreateCurveUseCase],
})
export class CurvesModule {}
