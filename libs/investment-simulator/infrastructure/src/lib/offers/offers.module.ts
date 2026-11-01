import { Module } from '@nestjs/common';
import {
  CreateOfferUseCase,
  CreateSimulationScopedOfferUseCase,
  DeleteOfferUseCase,
  DuplicateOfferUseCase,
  EditOfferUseCase,
  MoveOfferToCatalogUseCase,
  OfferRepository,
} from '@investflow/investment-simulator-application';
import { OfferController } from './http/offer.controller';
import { PrismaOfferRepository } from './persistence/prisma-offer.repository';
import { GetOfferQueryHandler } from './queries/get-offer.query-handler';
import { ListOffersQueryHandler } from './queries/list-offers.query-handler';

// Needs Clock and PrismaService from the host. Seed and import processes use
// it without HTTP to write system offers through the use cases.
@Module({
  controllers: [OfferController],
  providers: [
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    CreateOfferUseCase,
    EditOfferUseCase,
    DuplicateOfferUseCase,
    DeleteOfferUseCase,
    CreateSimulationScopedOfferUseCase,
    MoveOfferToCatalogUseCase,
    ListOffersQueryHandler,
    GetOfferQueryHandler,
  ],
  exports: [OfferRepository, CreateOfferUseCase],
})
export class OffersModule {}
