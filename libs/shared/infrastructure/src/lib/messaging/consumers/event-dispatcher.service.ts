import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { TransactionContext } from '../../persistence/prisma/transaction.context';
import { ON_EVENT_KEY } from './on-event.decorator';
import { ReceivedEvent } from './received-event';

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

@Injectable()
export class EventDispatcher {
  private readonly logger = new Logger(EventDispatcher.name);
  private readonly handlersByConsumer = new WeakMap<
    object,
    Map<string, EventHandler>
  >();

  constructor(private readonly prisma: PrismaService) {}

  async dispatch(consumer: object, event: ReceivedEvent): Promise<void> {
    const handlers = this.handlersOf(consumer);
    const consumerName = consumer.constructor.name;

    await this.prisma.$transaction((tx) =>
      TransactionContext.run(tx, async () => {
        // Skipping duplicates inside the transaction makes concurrent
        // deliveries of the same event wait for the first one to commit.
        const { count } = await tx.processedEvent.createMany({
          data: [{ consumer: consumerName, eventId: event.eventId }],
          skipDuplicates: true,
        });
        if (count === 0) {
          this.logger.warn(
            `Duplicate event ${event.eventId} for ${consumerName}, skipping`,
          );
          return;
        }

        const handler = handlers.get(event.eventType);
        if (!handler) {
          this.logger.warn(
            `No @OnEvent('${event.eventType}') on ${consumerName}, skipping`,
          );
          return;
        }

        await handler(event.payload);
      }),
    );
  }

  private handlersOf(consumer: object): Map<string, EventHandler> {
    const cached = this.handlersByConsumer.get(consumer);
    if (cached) return cached;

    const handlers = new Map<string, EventHandler>();
    const prototype = Object.getPrototypeOf(consumer) as Record<
      string,
      unknown
    >;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      const method = prototype[methodName];
      if (typeof method !== 'function') continue;

      const eventType = Reflect.getMetadata(ON_EVENT_KEY, method) as unknown;
      if (typeof eventType !== 'string') continue;

      if (handlers.has(eventType)) {
        throw new Error(
          `Duplicate @OnEvent('${eventType}') on ${consumer.constructor.name}`,
        );
      }
      handlers.set(eventType, (method as EventHandler).bind(consumer));
    }

    this.handlersByConsumer.set(consumer, handlers);
    return handlers;
  }
}
