import { Module } from '@nestjs/common';
import {
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  CalculateSimulationUseCase,
  FailSimulationCalculationUseCase,
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
import { SimulationCalculationConsumer } from './simulations/messaging/simulation-calculation.consumer';
import { PrismaSimulationRepository } from './simulations/persistence/prisma-simulation.repository';
import { ListSimulationMonthlyBalancesQueryHandler } from './simulations/queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from './simulations/queries/list-simulations.query-handler';
import { SimulationWorkspaceController } from './simulation-workspaces/http/simulation-workspace.controller';
import { GetSimulationOptionsQueryHandler } from './simulation-workspaces/queries/get-simulation-options.query-handler';
import { GetSimulationWorkspaceQueryHandler } from './simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { InvestmentSimulatorController } from './investment-simulator.controller';
import { CurvesModule } from './curves/curves.module';
import { OffersModule } from './offers/offers.module';

@Module({
  imports: [CurvesModule, OffersModule],
  controllers: [
    InvestmentSimulatorController,
    SimulationController,
    SimulationWorkspaceController,
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
    ListSimulationsQueryHandler,
    ListSimulationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
