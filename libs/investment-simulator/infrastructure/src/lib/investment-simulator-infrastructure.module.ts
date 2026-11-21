import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  BuildSimulationComparisonUseCase,
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsUseCase,
  RecalculateSimulationUseCase,
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
  premiseCopyBindings,
  simulationRepositoryBinding,
} from './experiments/simulation-experiment-bindings';
import { SimulationController } from './simulations/http/simulation.controller';
import { SimulationCalculationFailureConsumer } from './simulations/messaging/simulation-calculation-failure.consumer';
import { SimulationCalculationConsumer } from './simulations/messaging/simulation-calculation.consumer';
import { ListSimulationMonthlyBalancesQueryHandler } from './simulations/queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from './simulations/queries/list-simulations.query-handler';
import { SimulationComparisonController } from './simulation-comparisons/http/simulation-comparison.controller';
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
    SimulationCalculationConsumer,
    SimulationCalculationFailureConsumer,
    RecalculateOfferSimulationsUseCase,
    RecalculateCurveSimulationsUseCase,
    ...premiseCopyBindings,
    ListSimulationsQueryHandler,
    ListSimulationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
    BuildSimulationComparisonUseCase,
    GetSimulationComparisonQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
