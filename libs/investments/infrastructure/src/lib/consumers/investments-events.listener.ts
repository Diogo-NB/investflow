import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnEvent,
  PrismaService,
  SqsConsumerBase,
} from '@investflow/shared-infrastructure';

@Injectable()
export class InvestmentsEventsListener extends SqsConsumerBase {
  constructor(
    private readonly config: ConfigService,
    prisma: PrismaService,
  ) {
    super(config, prisma);
  }

  protected getQueueUrl(): string {
    return this.config.getOrThrow<string>('SQS_INVESTMENTS_QUEUE_URL');
  }

  @OnEvent('OrderCreatedEvent')
  async handleOrderCreated(payload: unknown): Promise<void> {
    console.log(
      '[InvestmentsEventsListener] OrderCreatedEvent received',
      payload,
    );
    // TODO: call StartOrderAnalysisUseCase
  }

  @OnEvent('OrderApprovedEvent')
  async handleOrderApproved(payload: unknown): Promise<void> {
    console.log(
      '[InvestmentsEventsListener] OrderApprovedEvent received',
      payload,
    );
    // TODO: call CreateApplicationUseCase
  }

  @OnEvent('ProductPublished')
  async handleProductPublished(payload: unknown): Promise<void> {
    console.log(
      '[InvestmentsEventsListener] ProductPublished received',
      payload,
    );
  }
}
