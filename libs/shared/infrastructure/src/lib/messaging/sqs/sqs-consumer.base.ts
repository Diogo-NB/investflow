import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { TransactionContext } from '../../persistence/prisma/transaction.context';
import { ON_EVENT_KEY } from './on-event.decorator';

interface SnsEnvelope {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
}

@Injectable()
export abstract class SqsConsumerBase implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(this.constructor.name);
  private readonly sqsClient: SQSClient;
  private readonly dispatchMap = new Map<
    string,
    (payload: unknown) => Promise<void>
  >();
  private resolvedQueueUrl!: string;
  private running = false;

  constructor(
    config: ConfigService,
    protected readonly prisma: PrismaService,
  ) {
    this.sqsClient = new SQSClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
  }

  protected abstract getQueueUrl(): string;

  onModuleInit(): void {
    this.resolvedQueueUrl = this.getQueueUrl();
    this.buildDispatchMap();
    this.running = true;
    void this.poll();
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  private buildDispatchMap(): void {
    const prototype = Object.getPrototypeOf(this) as Record<string, unknown>;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      const method = prototype[methodName];
      if (typeof method !== 'function') continue;

      const eventType = Reflect.getMetadata(ON_EVENT_KEY, method) as unknown;
      if (typeof eventType !== 'string') continue;

      if (this.dispatchMap.has(eventType)) {
        throw new Error(
          `Duplicate @OnEvent('${eventType}') on ${this.constructor.name}`,
        );
      }

      this.dispatchMap.set(
        eventType,
        (method as (payload: unknown) => Promise<void>).bind(this),
      );
    }
  }

  private async poll(): Promise<void> {
    while (this.running) {
      const response = await this.sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: this.resolvedQueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
        }),
      );

      this.logger.debug(`Pooled messages: ${response.Messages}`);

      for (const message of response.Messages ?? []) {
        await this.processMessage(message);
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return;

    const envelope = JSON.parse(message.Body) as SnsEnvelope;
    const domainEvent = JSON.parse(envelope.Message) as Record<string, unknown>;
    const eventId = domainEvent['eventId'];

    if (typeof eventId !== 'string') {
      this.logger.error(
        `Message missing eventId, discarding: ${message.MessageId}`,
      );
      await this.deleteMessage(message.ReceiptHandle);
      return;
    }

    try {
      const alreadyProcessed =
        await this.prisma.client.processedEvent.findUnique({
          where: { id: eventId },
        });

      if (alreadyProcessed) {
        this.logger.warn(`Duplicate event ${eventId}, skipping`);
        await this.deleteMessage(message.ReceiptHandle);
        return;
      }

      await this.prisma.$transaction((tx) =>
        TransactionContext.run(tx, async () => {
          await tx.processedEvent.create({ data: { id: eventId } });
          await this.dispatch(domainEvent);
        }),
      );
      await this.deleteMessage(message.ReceiptHandle);
    } catch (err) {
      // Do NOT delete - let visibility timeout expire so SQS retries and eventually moves to DLQ
      this.logger.error(`Failed processing event ${eventId}`, err);
    }
  }

  private async dispatch(eventPayload: Record<string, unknown>): Promise<void> {
    const eventType = eventPayload['eventType'];
    if (typeof eventType !== 'string') {
      this.logger.warn(`Event missing eventType, skipping dispatch`);
      return;
    }

    const handler = this.dispatchMap.get(eventType);
    if (!handler) {
      this.logger.warn(
        `No @OnEvent('${eventType}') found on ${this.constructor.name}, skipping`,
      );
      return;
    }

    await handler(eventPayload);
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.resolvedQueueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
