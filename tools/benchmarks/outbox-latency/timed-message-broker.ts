import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  AwsConfig,
  EventBridgeConfig,
  EventBridgeMessageBroker,
  MessageBroker,
  OutboxMessage,
  RejectedMessage,
} from '@investflow/shared-infrastructure';
import type { BenchmarkOptions } from './benchmark-options';

type Publish = MessageBroker['publish'];

// Wraps the broker the outbox publishes to and records, per event, when its
// first publish call started, when the broker first rejected it, and when it
// accepted it.
export class TimedMessageBroker extends MessageBroker {
  private readonly firstCalls = new Map<string, number>();
  private readonly rejections = new Map<string, number>();
  private readonly acceptances = new Map<string, number>();
  private callCount = 0;

  constructor(private readonly target: Publish) {
    super();
  }

  static create(
    options: BenchmarkOptions,
    aws: AwsConfig,
    eventBridge: EventBridgeConfig,
  ): TimedMessageBroker {
    if (options.broker === 'floci') {
      const broker = new EventBridgeMessageBroker(aws, eventBridge);
      return new TimedMessageBroker((messages, signal) =>
        broker.publish(messages, signal),
      );
    }

    const called = new Set<string>();
    return new TimedMessageBroker(async (messages) => {
      await sleep(options.rttMs * (0.7 + Math.random() * 0.6));
      const rejected = messages.filter(
        ({ eventId }) =>
          !called.has(eventId) && Math.random() < options.rejectRate,
      );
      for (const { eventId } of messages) called.add(eventId);
      return rejected.map(({ eventId }) => ({
        eventId,
        reason: 'Rejected by the simulated broker',
      }));
    });
  }

  get calls(): number {
    return this.callCount;
  }

  firstCallAt(eventId: string): number | undefined {
    return this.firstCalls.get(eventId);
  }

  acceptedAt(eventId: string): number | undefined {
    return this.acceptances.get(eventId);
  }

  // Rejection → acceptance, per event the broker rejected and then accepted.
  retryWaitsMs(): number[] {
    return [...this.rejections].flatMap(([eventId, rejectedAt]) => {
      const acceptedAt = this.acceptances.get(eventId);
      return acceptedAt === undefined ? [] : [acceptedAt - rejectedAt];
    });
  }

  reset(): void {
    this.firstCalls.clear();
    this.rejections.clear();
    this.acceptances.clear();
    this.callCount = 0;
  }

  async publish(
    messages: readonly OutboxMessage[],
    signal: AbortSignal,
  ): Promise<readonly RejectedMessage[]> {
    this.callCount++;
    const calledAt = performance.now();
    for (const { eventId } of messages) {
      if (!this.firstCalls.has(eventId)) this.firstCalls.set(eventId, calledAt);
    }

    const rejected = await this.target(messages, signal);
    const answeredAt = performance.now();
    const rejectedIds = new Set(rejected.map(({ eventId }) => eventId));
    for (const { eventId } of messages) {
      if (rejectedIds.has(eventId)) {
        if (!this.rejections.has(eventId))
          this.rejections.set(eventId, answeredAt);
        continue;
      }
      if (!this.acceptances.has(eventId))
        this.acceptances.set(eventId, answeredAt);
    }
    return rejected;
  }
}
