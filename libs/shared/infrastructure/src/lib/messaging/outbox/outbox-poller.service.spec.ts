import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import { MessageBroker } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxTopicRegistry } from './outbox-topic.registry';
import { PrismaService } from '../../persistence/prisma/prisma.service';

describe('OutboxPollerService', () => {
  it('uses the clock when marking a published event', async () => {
    const event = {
      id: 'event-id',
      context: 'test-context',
      payload: { eventType: 'TestEvent' },
    };
    const update = jest.fn().mockResolvedValue(event);
    const prisma = {
      client: {
        outboxEvent: {
          findMany: jest.fn().mockResolvedValue([event]),
        },
      },
      $transaction: jest.fn(
        async (operation: (client: unknown) => Promise<void>) =>
          operation({ outboxEvent: { update } }),
      ),
    } as unknown as PrismaService;
    const topicRegistry = {
      resolve: jest.fn().mockReturnValue('topic-arn'),
    } as unknown as OutboxTopicRegistry;
    const messageBroker = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as MessageBroker;
    const publishedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');
    const clock: Clock = {
      now: () => publishedAt,
      today: () => CalendarDate.of('2026-01-02'),
    };
    const poller = new OutboxPollerService(
      prisma,
      topicRegistry,
      messageBroker,
      clock,
    );

    await poller.poll();

    expect(messageBroker.publish).toHaveBeenCalledWith(
      'topic-arn',
      JSON.stringify(event.payload),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { publishedAt: publishedAt.date },
    });
  });
});
