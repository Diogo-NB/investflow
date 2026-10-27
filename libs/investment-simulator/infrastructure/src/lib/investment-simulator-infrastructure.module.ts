import { Module } from '@nestjs/common';
import {
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  CalculateSimulationUseCase,
  FailSimulationCalculationUseCase,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsUseCase,
  RecalculateSimulationUseCase,
  SimulationPremisesService,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import {
  InvestmentCalculator,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { BusinessCalendarController } from './business-calendar/http/business-calendar.controller';
import { GetBusinessCalendarQueryHandler } from './business-calendar/queries/get-business-calendar.query-handler';
import { SimulationController } from './simulations/http/simulation.controller';
import { SimulationCalculationFailureConsumer } from './simulations/messaging/simulation-calculation-failure.consumer';
import { SimulationRecalculationConsumer } from './simulations/messaging/simulation-recalculation.consumer';
import { SimulationCalculationConsumer } from './simulations/messaging/simulation-calculation.consumer';
import { PrismaSimulationRepository } from './simulations/persistence/prisma-simulation.repository';
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
  imports: [CurvesModule, OffersModule, InvestmentPlansModule],
  controllers: [
    SimulationController,
    SimulationWorkspaceController,
    SimulationComparisonController,
    BusinessCalendarController,
  ],
  providers: [
    { provide: InvestmentCalculator, useValue: new InvestmentCalculator() },
    {
      provide: SimulationCalculationService,
      useFactory: (calculator: InvestmentCalculator) =>
        new SimulationCalculationService(calculator),
      inject: [InvestmentCalculator],
    },
    GetBusinessCalendarQueryHandler,
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
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
    ListSimulationsQueryHandler,
    ListSimulationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
    GetSimulationComparisonQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
