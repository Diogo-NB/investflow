import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IMessageBroker, MESSAGE_BROKER } from './message-broker.port';

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);

  constructor(
    private readonly prisma: PrismaService,
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
      await this.prisma.$transaction(async (tx) => {
        await this.messageBroker.publish(
          event.context,
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
