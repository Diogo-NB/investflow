import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  ApplyPublishedIndexValuesUseCase,
  CreateCurveUseCase,
  DeleteCurveUseCase,
  DuplicateCurveUseCase,
  EditCurveUseCase,
} from '@investflow/investment-simulator-application';
import { experimentsConfig } from '@investflow/shared-infrastructure';
import { curveRepositoryBinding } from '../experiments/simulation-experiment-bindings';
import { CurveController } from './http/curve.controller';
import { PublishedIndexValuesConsumer } from './messaging/published-index-values.consumer';
import { GetCurveQueryHandler } from './queries/get-curve.query-handler';
import { ListCurvesQueryHandler } from './queries/list-curves.query-handler';

// Needs Clock and PrismaService from the host. Seed and import processes use
// it without HTTP to write system curves through the use cases.
@Module({
  imports: [ConfigModule.forFeature(experimentsConfig)],
  controllers: [CurveController],
  providers: [
    curveRepositoryBinding,
    ApplyPublishedIndexValuesUseCase,
    PublishedIndexValuesConsumer,
    CreateCurveUseCase,
    EditCurveUseCase,
    DuplicateCurveUseCase,
    DeleteCurveUseCase,
    ListCurvesQueryHandler,
    GetCurveQueryHandler,
  ],
  exports: [curveRepositoryBinding.provide, CreateCurveUseCase],
})
export class CurvesModule {}
