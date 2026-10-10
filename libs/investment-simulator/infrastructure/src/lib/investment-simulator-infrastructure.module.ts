import { Module } from '@nestjs/common';
import {
  CalculateSimulationUseCase,
  CreateOfferUseCase,
  DeleteOfferUseCase,
  DeleteSimulationUseCase,
  IndexCurveRepository,
  IssuerRepository,
  OfferRepository,
  SimulationCalculationRepository,
  SimulationRepository,
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
import { PrismaIssuerRepository } from './issuers/persistence/prisma-issuer.repository';
import { OfferController } from './offers/http/offer.controller';
import { PrismaOfferRepository } from './offers/persistence/prisma-offer.repository';
import { PrismaIndexCurveRepository } from './index-curves/persistence/prisma-index-curve.repository';
import { ListOffersQueryHandler } from './offers/queries/list-offers.query-handler';
import { GetOfferQueryHandler } from './offers/queries/get-offer.query-handler';
import { ListIssuersQueryHandler } from './issuers/queries/list-issuers.query-handler';
import { IssuerController } from './issuers/http/issuer.controller';

@Module({
  controllers: [
    InvestmentSimulatorController,
    OfferController,
    IssuerController,
    SimulationController,
    SimulationWorkspaceController,
    BusinessCalendarController,
  ],
  providers: [
    { provide: IndexCurveRepository, useClass: PrismaIndexCurveRepository },
    { provide: IssuerRepository, useClass: PrismaIssuerRepository },
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    CreateOfferUseCase,
    UpdateOfferUseCase,
    DeleteOfferUseCase,
    ListOffersQueryHandler,
    GetOfferQueryHandler,
    ListIssuersQueryHandler,
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
    CalculateSimulationUseCase,
    DeleteSimulationUseCase,
    ListSimulationsQueryHandler,
    ListCalculationMonthlyBalancesQueryHandler,
    GetSimulationOptionsQueryHandler,
    GetSimulationWorkspaceQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
