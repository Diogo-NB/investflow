import { Module } from '@nestjs/common';
import { PublishedIndexValuesController } from './http/published-index-values.controller';
import { GetLatestPublishedIndexValuesQueryHandler } from './queries/get-latest-published-index-values.query-handler';

// Needs PrismaService from the host.
@Module({
  controllers: [PublishedIndexValuesController],
  providers: [GetLatestPublishedIndexValuesQueryHandler],
})
export class PublishedIndexValuesHttpModule {}
