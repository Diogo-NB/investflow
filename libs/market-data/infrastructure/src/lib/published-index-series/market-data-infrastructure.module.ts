import { Module } from '@nestjs/common';
import {
  FetchNewPublishedIndexValuesUseCase,
  PublishedIndexSeriesRepository,
  PublishedIndexValuesReader,
  RecordPublishedIndexValuesUseCase,
} from '@investflow/market-data-application';
import { BcbPublishedIndexValuesReader } from './bcb/bcb-published-index-values-reader.service';
import { PublishedIndexValuesImportJob } from './jobs/published-index-values-import.job';
import { PrismaPublishedIndexSeriesRepository } from './persistence/prisma-published-index-series.repository';

// Needs Clock, PrismaService, UnitOfWork, and DomainEventRecorder from the host.
@Module({
  providers: [
    {
      provide: PublishedIndexSeriesRepository,
      useClass: PrismaPublishedIndexSeriesRepository,
    },
    {
      provide: PublishedIndexValuesReader,
      useClass: BcbPublishedIndexValuesReader,
    },
    FetchNewPublishedIndexValuesUseCase,
    RecordPublishedIndexValuesUseCase,
    PublishedIndexValuesImportJob,
  ],
  exports: [PublishedIndexValuesImportJob],
})
export class MarketDataInfrastructureModule {}
