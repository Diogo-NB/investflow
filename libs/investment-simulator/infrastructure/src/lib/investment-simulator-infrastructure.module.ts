import { Module } from '@nestjs/common';
import {
  CreateOfferUseCase,
  DeleteOfferUseCase,
  IssuerRepository,
  OfferRepository,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { InvestmentSimulatorController } from './investment-simulator.controller';
import { PrismaIssuerRepository } from './issuers/persistence/prisma-issuer.repository';
import { OfferController } from './offers/http/offer.controller';
import { PrismaOfferRepository } from './offers/persistence/prisma-offer.repository';

@Module({
  controllers: [InvestmentSimulatorController, OfferController],
  providers: [
    { provide: IssuerRepository, useClass: PrismaIssuerRepository },
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    CreateOfferUseCase,
    UpdateOfferUseCase,
    DeleteOfferUseCase,
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
