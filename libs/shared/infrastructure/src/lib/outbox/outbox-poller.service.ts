import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MESSAGE_BROKER } from './message-broker.port';
import type { IMessageBroker } from './message-broker.port';

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);

  private readonly topicArnByContext: Record<string, string>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Inject(MESSAGE_BROKER) private readonly messageBroker: IMessageBroker,
  ) {
    this.topicArnByContext = {
      'investflow-investments': config.getOrThrow<string>(
        'SNS_INVESTMENTS_TOPIC_ARN',
      ),
    };
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async poll(): Promise<void> {
    const events = await this.prisma.client.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (events.length === 0) return;

    for (const event of events) {
      const topicArn = this.topicArnByContext[event.context];
      if (!topicArn) {
        this.logger.error(
          `No SNS topic ARN configured for context "${event.context}" - skipping event ${event.id}`,
        );
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await this.messageBroker.publish(
          topicArn,
          JSON.stringify(event.payload),
        );
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });
      });
    }
  }
}
