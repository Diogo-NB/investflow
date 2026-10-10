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
  ReviseApplicationUseCase,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { ApplicationController } from './applications/http/application.controller';
import { PrismaApplicationRepository } from './applications/persistence/prisma-application.repository';
import { GetApplicationQueryHandler } from './applications/queries/get-application.query-handler';
import { ListApplicationsQueryHandler } from './applications/queries/list-applications.query-handler';
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
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
