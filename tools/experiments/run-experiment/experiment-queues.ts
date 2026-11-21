import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  type Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import type { ExperimentRunnerConfig } from './experiment-runner.config';

interface ConsumerQueue {
  readonly url: string;
  readonly deadLetterUrl: string;
}

export interface QueueCounts {
  // Visible, in flight, and delayed messages of the consumed queues.
  readonly queued: number;
  readonly deadLettered: number;
}

// Rounds of peeking per dead-letter queue: each receive returns at most 10
// messages, and a peek does not hide them, so later rounds may return the
// same ones; a run dead-letters a handful.
const PEEK_ROUNDS = 3;

// The consumed queues and their dead-letter queues, observed and handled the
// way an operator would: nothing here reaches the API's code.
export class ExperimentQueues {
  private readonly consumerQueues: readonly ConsumerQueue[];
  private readonly deadLetterUrls: readonly string[];

  constructor(
    private readonly sqs: SQSClient,
    { queues }: ExperimentRunnerConfig,
  ) {
    this.consumerQueues = [
      {
        url: queues.calculations,
        deadLetterUrl: queues.calculationsDeadLetter,
      },
      {
        url: queues.recalculations,
        deadLetterUrl: queues.recalculationsDeadLetter,
      },
      {
        url: queues.publishedIndexValues,
        deadLetterUrl: queues.publishedIndexValuesDeadLetter,
      },
    ];
    this.deadLetterUrls = [
      ...this.consumerQueues.map(({ deadLetterUrl }) => deadLetterUrl),
      ...(queues.eventDeliveryDeadLetter
        ? [queues.eventDeliveryDeadLetter]
        : []),
    ];
  }

  async counts(): Promise<QueueCounts> {
    const [queued, deadLettered] = await Promise.all([
      this.messageCount(this.consumerQueues.map(({ url }) => url)),
      this.messageCount(this.deadLetterUrls),
    ]);
    return { queued, deadLettered };
  }

  // The aggregates with a message in any dead-letter queue, which counts as
  // the alarm having fired for them.
  async deadLetteredAggregateIds(): Promise<Set<string>> {
    const aggregateIds = new Set<string>();
    for (const url of this.deadLetterUrls) {
      for (let round = 0; round < PEEK_ROUNDS; round++) {
        const messages = await this.receive(url, 0);
        if (messages.length === 0) break;
        for (const message of messages) {
          const aggregateId = aggregateIdOf(message);
          if (aggregateId) aggregateIds.add(aggregateId);
        }
      }
    }
    return aggregateIds;
  }

  // Empties every dead-letter queue, so a run starts without another run's
  // messages. Returns how many it deleted.
  async drainDeadLetterQueues(): Promise<number> {
    let deleted = 0;
    for (const url of this.deadLetterUrls) {
      for (const message of await this.receiveAll(url)) {
        await this.delete(url, message);
        deleted++;
      }
    }
    return deleted;
  }

  // Sends each dead-lettered message back to the queue it came from, as the
  // console's redrive does, and returns how many it sent. The event delivery
  // dead-letter queue has no source queue to return to.
  async redriveDeadLetterQueues(): Promise<number> {
    let redriven = 0;
    for (const { url, deadLetterUrl } of this.consumerQueues) {
      for (const message of await this.receiveAll(deadLetterUrl)) {
        await this.sqs.send(
          new SendMessageCommand({
            QueueUrl: url,
            MessageBody: message.Body ?? '',
            MessageGroupId: aggregateIdOf(message) ?? 'redriven',
            // The queues deduplicate by content for five minutes, which
            // would drop a message dead-lettered sooner than that.
            MessageDeduplicationId: `redrive-${message.MessageId}`,
          }),
        );
        await this.delete(deadLetterUrl, message);
        redriven++;
      }
    }
    return redriven;
  }

  private async messageCount(urls: readonly string[]): Promise<number> {
    const counts = await Promise.all(
      urls.map(async (url) => {
        const { Attributes = {} } = await this.sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: url,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible',
              'ApproximateNumberOfMessagesDelayed',
            ],
          }),
        );
        return Object.values(Attributes).reduce(
          (sum, value) => sum + Number(value),
          0,
        );
      }),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }

  // Hidden for long enough to be deleted, so each is returned once.
  private async receiveAll(url: string): Promise<Message[]> {
    const received: Message[] = [];
    for (;;) {
      const messages = await this.receive(url, 60);
      if (messages.length === 0) return received;
      received.push(...messages);
    }
  }

  private async receive(
    url: string,
    visibilityTimeout: number,
  ): Promise<Message[]> {
    const { Messages = [] } = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: url,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: visibilityTimeout,
        WaitTimeSeconds: 0,
      }),
    );
    return Messages;
  }

  private async delete(url: string, message: Message): Promise<void> {
    await this.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: url,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }
}

// EventBridge delivers the event as the body, with the outbox's envelope in
// its detail.
function aggregateIdOf(message: Message): string | null {
  try {
    const body: unknown = JSON.parse(message.Body ?? '');
    if (typeof body !== 'object' || body === null || !('detail' in body)) {
      return null;
    }
    const { detail } = body;
    if (typeof detail !== 'object' || detail === null) return null;
    return 'aggregateId' in detail && typeof detail.aggregateId === 'string'
      ? detail.aggregateId
      : null;
  } catch {
    return null;
  }
}
