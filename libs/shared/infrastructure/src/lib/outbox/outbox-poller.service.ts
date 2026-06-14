import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MESSAGE_BROKER } from './message-broker.port';
import type { IMessageBroker } from './message-broker.port';
import { OutboxTopicRegistry } from './outbox-topic.registry';

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly topicRegistry: OutboxTopicRegistry,
    @Inject(MESSAGE_BROKER) private readonly messageBroker: IMessageBroker,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async poll(): Promise<void> {
    const events = await this.prisma.client.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (events.length === 0) return;

    for (const event of events) {
      const topicArn = this.topicRegistry.resolve(event.context);
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
