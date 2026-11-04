import { Controller, Get } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { GetLatestPublishedIndexValuesQueryHandler } from '../queries/get-latest-published-index-values.query-handler';

@Controller('market-data/published-index-values')
export class PublishedIndexValuesController {
  constructor(
    private readonly getLatestPublishedIndexValues: GetLatestPublishedIndexValuesQueryHandler,
  ) {}

  @Get('latest')
  @SkipTransaction()
  getLatest() {
    return this.getLatestPublishedIndexValues.execute();
  }
}
