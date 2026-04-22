import { Module } from '@nestjs/common';
import { PortfolioEventsListener } from './consumers/portfolio-events.listener';

@Module({
  providers: [PortfolioEventsListener],
})
export class PortfolioInfrastructureModule {}
