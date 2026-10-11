import { Module } from '@nestjs/common';
import {
  CalculateSimulationUseCase,
  CreateOfferUseCase,
  DeleteOfferUseCase,
  DeleteSimulationUseCase,
  OfferRepository,
  SimulationCalculationRepository,
  SimulationRepository,
  StartSimulationUseCase,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import {
  BrazilianBusinessDayCalendar,
  BusinessDayCalendar,
} from '@investflow/shared-domain';
import { BusinessCalendarController } from './business-calendar/http/business-calendar.controller';
import { ListNonBusinessDaysQueryHandler } from './business-calendar/queries/list-non-business-days.query-handler';
import { SimulationController } from './simulations/http/simulation.controller';
import { PrismaSimulationCalculationRepository } from './simulations/persistence/prisma-simulation-calculation.repository';
import { PrismaSimulationRepository } from './simulations/persistence/prisma-simulation.repository';
import { ListCalculationMonthlyBalancesQueryHandler } from './simulations/queries/list-calculation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from './simulations/queries/list-simulations.query-handler';
import { SimulationWorkspaceController } from './simulation-workspaces/http/simulation-workspace.controller';
import { GetSimulationOptionsQueryHandler } from './simulation-workspaces/queries/get-simulation-options.query-handler';
import { GetSimulationWorkspaceQueryHandler } from './simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { InvestmentSimulatorController } from './investment-simulator.controller';
import { OfferController } from './offers/http/offer.controller';
import { PrismaOfferRepository } from './offers/persistence/prisma-offer.repository';
import { CurvesModule } from './curves/curves.module';
import { ListOffersQueryHandler } from './offers/queries/list-offers.query-handler';
import { GetOfferQueryHandler } from './offers/queries/get-offer.query-handler';

@Module({
  imports: [CurvesModule],
  controllers: [
    InvestmentSimulatorController,
    OfferController,
    SimulationController,
    SimulationWorkspaceController,
    BusinessCalendarController,
  ],
  providers: [
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    CreateOfferUseCase,
    UpdateOfferUseCase,
    DeleteOfferUseCase,
    ListOffersQueryHandler,
    GetOfferQueryHandler,
    { provide: BusinessDayCalendar, useClass: BrazilianBusinessDayCalendar },
    {
      provide: InvestmentCalculator,
      useFactory: (calendar: BusinessDayCalendar) =>
        new InvestmentCalculator(calendar),
      inject: [BusinessDayCalendar],
    },
    ListNonBusinessDaysQueryHandler,
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    {
      provide: SimulationCalculationRepository,
      useClass: PrismaSimulationCalculationRepository,
    },
    StartSimulationUseCase,
    CalculateSimulationUseCase,
    DeleteSimulationUseCase,
    ListSimulationsQueryHandler,
    ListCalculationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
