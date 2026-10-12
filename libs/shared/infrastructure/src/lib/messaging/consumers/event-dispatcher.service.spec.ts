import { PrismaService } from '../../persistence/prisma/prisma.service';
import { UnitOfWork } from '../../persistence/unit-of-work';
import { EventDispatcher } from './event-dispatcher.service';
import { OnEvent } from './on-event.decorator';

class TestConsumer {
  readonly handled: unknown[] = [];

  @OnEvent('TestHappened')
  async onTestHappened(payload: Record<string, unknown>): Promise<void> {
    this.handled.push(payload);
  }
}

const event = {
  eventId: 'event-1',
  eventType: 'TestHappened',
  payload: { eventId: 'event-1', eventType: 'TestHappened' },
};

function createFixture(insertedCount = 1) {
  const createMany = jest.fn().mockResolvedValue({ count: insertedCount });
  const unitOfWork = {
    run: jest.fn((work: () => Promise<void>) => work()),
  } as unknown as UnitOfWork;
  const prisma = {
    client: { processedEvent: { createMany } },
  } as unknown as PrismaService;
  return { dispatcher: new EventDispatcher(unitOfWork, prisma), createMany };
}

describe('EventDispatcher', () => {
  it('records the event for the consumer and calls its handler', async () => {
    const { dispatcher, createMany } = createFixture();
    const consumer = new TestConsumer();

    await dispatcher.dispatch(consumer, event);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ consumer: 'TestConsumer', eventId: 'event-1' }],
      skipDuplicates: true,
    });
    expect(consumer.handled).toEqual([event.payload]);
  });

  it('skips an event the consumer already processed', async () => {
    const { dispatcher } = createFixture(0);
    const consumer = new TestConsumer();

    await dispatcher.dispatch(consumer, event);

    expect(consumer.handled).toEqual([]);
  });

  it('records an event type the consumer does not handle', async () => {
    const { dispatcher, createMany } = createFixture();
    const consumer = new TestConsumer();

    await dispatcher.dispatch(consumer, { ...event, eventType: 'Other' });

    expect(createMany).toHaveBeenCalled();
    expect(consumer.handled).toEqual([]);
  });

  it('propagates a handler failure so the transaction rolls back', async () => {
    const { dispatcher } = createFixture();
    class FailingConsumer {
      @OnEvent('TestHappened')
      async onTestHappened(): Promise<void> {
        throw new Error('handler failed');
      }
    }

    await expect(
      dispatcher.dispatch(new FailingConsumer(), event),
    ).rejects.toThrow('handler failed');
  });

  it('rejects a consumer with two handlers for the same event type', async () => {
    const { dispatcher } = createFixture();
    class AmbiguousConsumer {
      @OnEvent('TestHappened')
      async first(): Promise<void> {
        return;
      }

      @OnEvent('TestHappened')
      async second(): Promise<void> {
        return;
      }
    }

    await expect(
      dispatcher.dispatch(new AmbiguousConsumer(), event),
    ).rejects.toThrow(
      "Duplicate @OnEvent('TestHappened') on AmbiguousConsumer",
    );
  });
});
