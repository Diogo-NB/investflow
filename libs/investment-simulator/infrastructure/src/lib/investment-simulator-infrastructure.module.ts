import { Module } from '@nestjs/common';
import {
  CreateOfferUseCase,
  DeleteOfferUseCase,
  IndexCurveRepository,
  IssuerRepository,
  OfferRepository,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { InvestmentSimulatorController } from './investment-simulator.controller';
import { PrismaIssuerRepository } from './issuers/persistence/prisma-issuer.repository';
import { OfferController } from './offers/http/offer.controller';
import { PrismaOfferRepository } from './offers/persistence/prisma-offer.repository';
import { PrismaIndexCurveRepository } from './index-curves/persistence/prisma-index-curve.repository';

@Module({
  controllers: [InvestmentSimulatorController, OfferController],
  providers: [
    { provide: IndexCurveRepository, useClass: PrismaIndexCurveRepository },
    { provide: IssuerRepository, useClass: PrismaIssuerRepository },
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    CreateOfferUseCase,
    UpdateOfferUseCase,
    DeleteOfferUseCase,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
