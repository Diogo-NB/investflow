import { Logger } from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { EventDispatcher } from '../consumers/event-dispatcher.service';
import { ReceivedEvent } from '../consumers/received-event';

const RECEIVE_ERROR_BACKOFF_MS = 1_000;

export class SqsEventListener {
  private readonly logger: Logger;
  private abortController: AbortController | undefined;
  private loop: Promise<void> | undefined;

  constructor(
    private readonly sqsClient: SQSClient,
    private readonly queueUrl: string,
    private readonly consumer: object,
    private readonly dispatcher: EventDispatcher,
  ) {
    this.logger = new Logger(
      `${SqsEventListener.name}:${consumer.constructor.name}`,
    );
  }

  start(): void {
    this.abortController = new AbortController();
    this.loop = this.receiveUntilStopped(this.abortController.signal);
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    await this.loop;
  }

  private async receiveUntilStopped(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const response = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
          { abortSignal: signal },
        );

        for (const message of response.Messages ?? []) {
          await this.process(message);
        }
      } catch (error) {
        if (signal.aborted) return;
        this.logger.error(`Failed to receive from ${this.queueUrl}`, error);
        await new Promise((resolve) =>
          setTimeout(resolve, RECEIVE_ERROR_BACKOFF_MS),
        );
      }
    }
  }

  // A message is deleted only after it was handled or recognized as a
  // duplicate. Anything else becomes visible again after the visibility
  // timeout and is dead-lettered once the queue's receive limit is reached.
  async process(message: Message): Promise<void> {
    if (!message.ReceiptHandle) return;

    const event = this.parse(message.Body);
    if (!event) {
      this.logger.error(`Malformed message ${message.MessageId}, not handled`);
      return;
    }

    try {
      await this.dispatcher.dispatch(this.consumer, event);
    } catch (error) {
      this.logger.error(`Failed handling event ${event.eventId}`, error);
      return;
    }

    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  private parse(body: string | undefined): ReceivedEvent | undefined {
    if (!body) return undefined;

    let envelope: unknown;
    try {
      envelope = JSON.parse(body);
    } catch {
      return undefined;
    }

    const detail = isRecord(envelope) ? envelope['detail'] : undefined;
    if (!isRecord(detail)) return undefined;

    const { eventId, eventType } = detail;
    if (typeof eventId !== 'string' || typeof eventType !== 'string') {
      return undefined;
    }

    return { eventId, eventType, payload: detail };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
