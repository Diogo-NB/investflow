import { Controller, Get } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { ListIssuersQueryHandler } from '../queries/list-issuers.query-handler';

@Controller('investment-simulator/issuers')
export class IssuerController {
  constructor(private readonly listIssuers: ListIssuersQueryHandler) {}

  @Get()
  @SkipTransaction()
  list() {
    return this.listIssuers.execute();
  }
}
