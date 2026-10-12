import { Module } from '@nestjs/common';
import {
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  SimulationPremisesService,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import {
  BrazilianBusinessDayCalendar,
  BusinessDayCalendar,
} from '@investflow/shared-domain';
import { BusinessCalendarController } from './business-calendar/http/business-calendar.controller';
import { ListNonBusinessDaysQueryHandler } from './business-calendar/queries/list-non-business-days.query-handler';
import { SimulationController } from './simulations/http/simulation.controller';
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
    { provide: BusinessDayCalendar, useClass: BrazilianBusinessDayCalendar },
    {
      provide: InvestmentCalculator,
      useFactory: (calendar: BusinessDayCalendar) =>
        new InvestmentCalculator(calendar),
      inject: [BusinessDayCalendar],
    },
    ListNonBusinessDaysQueryHandler,
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    SimulationPremisesService,
    CreateSimulationUseCase,
    EditSimulationUseCase,
    DeleteSimulationUseCase,
    ListSimulationsQueryHandler,
    ListSimulationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
