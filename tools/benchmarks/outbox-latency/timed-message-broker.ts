import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeMessageBroker,
  MessageBroker,
  OutboxMessage,
  RejectedMessage,
} from '@investflow/shared-infrastructure';
import type { BenchmarkOptions } from './benchmark-options';

type Publish = MessageBroker['publish'];

// Wraps the broker the outbox publishes to and records, per event, when its
// first publish call started and when the broker accepted it.
export class TimedMessageBroker extends MessageBroker {
  private readonly firstCalls = new Map<string, number>();
  private readonly acceptances = new Map<string, number>();
  private callCount = 0;

  constructor(private readonly target: Publish) {
    super();
  }

  static create(
    options: BenchmarkOptions,
    config: ConfigService,
  ): TimedMessageBroker {
    if (options.broker === 'floci') {
      const eventBridge = new EventBridgeMessageBroker(config);
      return new TimedMessageBroker((messages, signal) =>
        eventBridge.publish(messages, signal),
      );
    }

    return new TimedMessageBroker(async () => {
      await sleep(options.rttMs * (0.7 + Math.random() * 0.6));
      return [];
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

  reset(): void {
    this.firstCalls.clear();
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
    const acceptedAt = performance.now();
    const rejectedIds = new Set(rejected.map(({ eventId }) => eventId));
    for (const { eventId } of messages) {
      if (rejectedIds.has(eventId) || this.acceptances.has(eventId)) continue;
      this.acceptances.set(eventId, acceptedAt);
    }
    return rejected;
  }
}
