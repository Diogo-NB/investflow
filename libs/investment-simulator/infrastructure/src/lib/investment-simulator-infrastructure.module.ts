import { Module } from '@nestjs/common';
import {
  ApplicationRepository,
  CreateApplicationUseCase,
  CreateOfferUseCase,
  DeleteApplicationUseCase,
  DeleteOfferUseCase,
  IndexCurveRepository,
  IssuerRepository,
  OfferRepository,
  RecordSimulationRunUseCase,
  ReviseApplicationUseCase,
  SimulationRunRepository,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import { BrazilianBusinessDayCalendar } from '@investflow/shared-domain';
import { ApplicationController } from './applications/http/application.controller';
import { PrismaApplicationRepository } from './applications/persistence/prisma-application.repository';
import { GetApplicationQueryHandler } from './applications/queries/get-application.query-handler';
import { ListApplicationsQueryHandler } from './applications/queries/list-applications.query-handler';
import { SimulationRunController } from './simulation-runs/http/simulation-run.controller';
import { PrismaSimulationRunRepository } from './simulation-runs/persistence/prisma-simulation-run.repository';
import { GetSimulationRunQueryHandler } from './simulation-runs/queries/get-simulation-run.query-handler';
import { ListApplicationRunsQueryHandler } from './simulation-runs/queries/list-application-runs.query-handler';
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
    ApplicationController,
    SimulationRunController,
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
    { provide: ApplicationRepository, useClass: PrismaApplicationRepository },
    CreateApplicationUseCase,
    ReviseApplicationUseCase,
    DeleteApplicationUseCase,
    ListApplicationsQueryHandler,
    GetApplicationQueryHandler,
    {
      provide: InvestmentCalculator,
      useFactory: () =>
        new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    },
    {
      provide: SimulationRunRepository,
      useClass: PrismaSimulationRunRepository,
    },
    RecordSimulationRunUseCase,
    ListApplicationRunsQueryHandler,
    GetSimulationRunQueryHandler,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
