import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent, PrismaService, SqsConsumerBase } from '@investflow/shared-infrastructure';

@Injectable()
export class PortfolioEventsListener extends SqsConsumerBase {
  constructor(
    private readonly config: ConfigService,
    prisma: PrismaService,
  ) {
    super(config, prisma);
  }

  protected getQueueUrl(): string {
    return this.config.getOrThrow<string>('SQS_PORTFOLIO_QUEUE_URL');
  }

  @OnEvent('ApplicationCreated')
  async handleApplicationCreated(_payload: unknown): Promise<void> {
    // TODO: call CreatePortfolioPositionUseCase
  }

  @OnEvent('ApplicationValueUpdated')
  async handleApplicationValueUpdated(_payload: unknown): Promise<void> {
    // TODO: call UpdatePortfolioValueUseCase
  }

  @OnEvent('ApplicationMatured')
  async handleApplicationMatured(_payload: unknown): Promise<void> {
    // TODO: call MaturePortfolioPositionUseCase
  }

  @OnEvent('ApplicationRedeemed')
  async handleApplicationRedeemed(_payload: unknown): Promise<void> {
    // TODO: call RedeemPortfolioPositionUseCase
  }
}
