import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketDataInfrastructureModule } from '@investflow/market-data-infrastructure';
import { ClockModule, PrismaModule } from '@investflow/shared-infrastructure';

// Without OutboxModule: the job exits right after committing, so the API's
// poller publishes the events it records.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClockModule,
    PrismaModule,
  ],
  exports: [ClockModule],
})
class ImporterInfrastructureModule {}

@Module({
  imports: [ImporterInfrastructureModule, MarketDataInfrastructureModule],
})
export class ImporterModule {}
