import { Module } from '@nestjs/common';
import {
  CreateOfferUseCase,
  DeleteOfferUseCase,
  IssuerRepository,
  OfferRepository,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { Clock } from '@investflow/shared-application';
import { InvestmentSimulatorController } from './investment-simulator.controller';
import { PrismaIssuerRepository } from './issuers/persistence/prisma-issuer.repository';
import { OfferController } from './offers/http/offer.controller';
import { PrismaOfferRepository } from './offers/persistence/prisma-offer.repository';

@Module({
  controllers: [InvestmentSimulatorController, OfferController],
  providers: [
    { provide: IssuerRepository, useClass: PrismaIssuerRepository },
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    {
      provide: CreateOfferUseCase,
      inject: [IssuerRepository, OfferRepository],
      useFactory: (
        issuerRepository: IssuerRepository,
        offerRepository: OfferRepository,
      ) => new CreateOfferUseCase(issuerRepository, offerRepository),
    },
    {
      provide: UpdateOfferUseCase,
      inject: [OfferRepository],
      useFactory: (offerRepository: OfferRepository) =>
        new UpdateOfferUseCase(offerRepository),
    },
    {
      provide: DeleteOfferUseCase,
      inject: [OfferRepository, Clock],
      useFactory: (offerRepository: OfferRepository, clock: Clock) =>
        new DeleteOfferUseCase(offerRepository, clock),
    },
  ],
})
export class InvestmentSimulatorInfrastructureModule {}
