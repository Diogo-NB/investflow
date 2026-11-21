import { Logger } from '@nestjs/common';
import {
  MessageBroker,
  type OutboxMessage,
  type RejectedMessage,
} from '../messaging/outbox/message-broker.port';
import { ExperimentTargetMatcher } from './experiment-target-matcher';
import type { ExperimentTarget } from './experiments.config';

// Reports the target as rejected, so the outbox retries it, until the broker
// has accepted a later event of the same aggregate. The target is then
// delivered after an event that happened after it.
export class RejectUntilNewerMessageBroker extends MessageBroker {
  private readonly logger = new Logger(RejectUntilNewerMessageBroker.name);
  private readonly matcher: ExperimentTargetMatcher;
  private targetEventId: string | undefined;
  private isNewerEventAccepted = false;

  constructor(
    private readonly broker: MessageBroker,
    private readonly target: ExperimentTarget,
  ) {
    super();
    this.matcher = new ExperimentTargetMatcher(target);
  }

  async publish(
    messages: readonly OutboxMessage[],
    signal: AbortSignal,
  ): Promise<readonly RejectedMessage[]> {
    const held = messages.filter((message) => this.isHeld(message));
    const sent = messages.filter((message) => !held.includes(message));
    const rejected =
      sent.length > 0 ? await this.broker.publish(sent, signal) : [];

    const rejectedIds = new Set(rejected.map((message) => message.eventId));
    if (
      this.targetEventId !== undefined &&
      sent.some(
        (message) =>
          message.eventId !== this.targetEventId &&
          !rejectedIds.has(message.eventId) &&
          aggregateIdOf(message) === this.target.aggregateId,
      )
    ) {
      this.isNewerEventAccepted = true;
    }

    return [
      ...rejected,
      ...held.map((message) => {
        this.logger.warn(
          `Experiment fault: rejecting ${message.eventType} eventId=${message.eventId} until a newer event of its aggregate is published`,
        );
        return {
          eventId: message.eventId,
          reason: 'Experiment fault: held until a newer event is published',
        };
      }),
    ];
  }

  private isHeld(message: OutboxMessage): boolean {
    if (this.isNewerEventAccepted) return false;
    const isTarget = this.matcher.matches({
      eventId: message.eventId,
      eventType: message.eventType,
      aggregateId: aggregateIdOf(message),
    });
    if (isTarget) this.targetEventId = message.eventId;
    return isTarget;
  }
}

function aggregateIdOf(message: OutboxMessage): unknown {
  const payload: unknown = JSON.parse(message.payload);
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)['aggregateId']
    : undefined;
}
