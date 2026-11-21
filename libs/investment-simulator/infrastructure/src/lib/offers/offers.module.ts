import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CreateOfferUseCase,
  CreateSimulationScopedOfferUseCase,
  DeleteOfferUseCase,
  DuplicateOfferUseCase,
  EditOfferUseCase,
  MoveOfferToCatalogUseCase,
} from '@investflow/investment-simulator-application';
import { experimentsConfig } from '@investflow/shared-infrastructure';
import { offerRepositoryBinding } from '../experiments/simulation-experiment-bindings';
import { OfferController } from './http/offer.controller';
import { GetOfferQueryHandler } from './queries/get-offer.query-handler';
import { ListOffersQueryHandler } from './queries/list-offers.query-handler';

// Needs Clock and PrismaService from the host. Seed and import processes use
// it without HTTP to write system offers through the use cases.
@Module({
  imports: [ConfigModule.forFeature(experimentsConfig)],
  controllers: [OfferController],
  providers: [
    offerRepositoryBinding,
    CreateOfferUseCase,
    EditOfferUseCase,
    DuplicateOfferUseCase,
    DeleteOfferUseCase,
    CreateSimulationScopedOfferUseCase,
    MoveOfferToCatalogUseCase,
    ListOffersQueryHandler,
    GetOfferQueryHandler,
  ],
  exports: [offerRepositoryBinding.provide, CreateOfferUseCase],
})
export class OffersModule {}
