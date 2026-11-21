import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  BuildSimulationComparisonUseCase,
  ComparedSimulationReader,
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  CalculateSimulationUseCase,
  FailSimulationCalculationUseCase,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsUseCase,
  RecalculateSimulationUseCase,
  SimulationResultValidityReader,
  SimulationPremisesService,
} from '@investflow/investment-simulator-application';
import {
  InvestmentCalculator,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { experimentsConfig } from '@investflow/shared-infrastructure';
import { BusinessCalendarController } from './business-calendar/http/business-calendar.controller';
import { GetBusinessCalendarQueryHandler } from './business-calendar/queries/get-business-calendar.query-handler';
import {
  investmentCalculatorBinding,
  simulationRepositoryBinding,
} from './experiments/simulation-experiment-bindings';
import { SimulationController } from './simulations/http/simulation.controller';
import { SimulationCalculationFailureConsumer } from './simulations/messaging/simulation-calculation-failure.consumer';
import { SimulationRecalculationConsumer } from './simulations/messaging/simulation-recalculation.consumer';
import { SimulationCalculationConsumer } from './simulations/messaging/simulation-calculation.consumer';
import { PrismaSimulationResultValidityReader } from './simulations/persistence/prisma-simulation-result-validity-reader';
import { ListSimulationMonthlyBalancesQueryHandler } from './simulations/queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from './simulations/queries/list-simulations.query-handler';
import { SimulationComparisonController } from './simulation-comparisons/http/simulation-comparison.controller';
import { PrismaComparedSimulationReader } from './simulation-comparisons/persistence/prisma-compared-simulation-reader';
import { GetSimulationComparisonQueryHandler } from './simulation-comparisons/queries/get-simulation-comparison.query-handler';
import { SimulationWorkspaceController } from './simulation-workspaces/http/simulation-workspace.controller';
import { GetSimulationOptionsQueryHandler } from './simulation-workspaces/queries/get-simulation-options.query-handler';
import { GetSimulationWorkspaceQueryHandler } from './simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { CurvesModule } from './curves/curves.module';
import { InvestmentPlansModule } from './investment-plans/investment-plans.module';
import { OffersModule } from './offers/offers.module';

@Module({
  imports: [
    CurvesModule,
    OffersModule,
    InvestmentPlansModule,
    ConfigModule.forFeature(experimentsConfig),
  ],
  controllers: [
    SimulationController,
    SimulationWorkspaceController,
    SimulationComparisonController,
    BusinessCalendarController,
  ],
  providers: [
    investmentCalculatorBinding,
    {
      provide: SimulationCalculationService,
      useFactory: (calculator: InvestmentCalculator) =>
        new SimulationCalculationService(calculator),
      inject: [InvestmentCalculator],
    },
    GetBusinessCalendarQueryHandler,
    simulationRepositoryBinding,
    SimulationPremisesService,
    CreateSimulationUseCase,
    EditSimulationUseCase,
    DeleteSimulationUseCase,
    RecalculateSimulationUseCase,
    CalculateSimulationUseCase,
    FailSimulationCalculationUseCase,
    SimulationCalculationConsumer,
    SimulationCalculationFailureConsumer,
    RecalculateOfferSimulationsUseCase,
    RecalculateCurveSimulationsUseCase,
    SimulationRecalculationConsumer,
    {
      provide: SimulationResultValidityReader,
      useClass: PrismaSimulationResultValidityReader,
    },
    ListSimulationsQueryHandler,
    ListSimulationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
    {
      provide: ComparedSimulationReader,
      useClass: PrismaComparedSimulationReader,
    },
    BuildSimulationComparisonUseCase,
    GetSimulationComparisonQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
