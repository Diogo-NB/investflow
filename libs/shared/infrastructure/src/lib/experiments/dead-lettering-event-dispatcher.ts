import { EventDispatcher } from '../messaging/consumers/event-dispatcher';
import { ReceivedEvent } from '../messaging/consumers/received-event';
import { ExperimentTargetMatcher } from './experiment-target-matcher';
import type { ExperimentTarget } from './experiments.config';

// Fails every receive of the target, so the queue dead-letters it after its
// receive limit. The dead-letter consumer gets the same event again, so the
// fault stays with the consumer that first received it.
export class DeadLetteringEventDispatcher extends EventDispatcher {
  private readonly matcher: ExperimentTargetMatcher;
  private faultedConsumerName: string | undefined;

  constructor(
    private readonly dispatcher: EventDispatcher,
    target: ExperimentTarget,
  ) {
    super();
    this.matcher = new ExperimentTargetMatcher(target);
  }

  async dispatch(consumer: object, event: ReceivedEvent): Promise<void> {
    const consumerName = consumer.constructor.name;
    if (!this.isFaulted(consumerName, event)) {
      return this.dispatcher.dispatch(consumer, event);
    }
    throw new Error(
      `Experiment fault: failing ${event.eventType} eventId=${event.eventId} for ${consumerName} until it is dead-lettered`,
    );
  }

  private isFaulted(consumerName: string, event: ReceivedEvent): boolean {
    if (
      this.faultedConsumerName !== undefined &&
      this.faultedConsumerName !== consumerName
    ) {
      return false;
    }
    const isTarget = this.matcher.matches({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.payload['aggregateId'],
    });
    if (isTarget) this.faultedConsumerName = consumerName;
    return isTarget;
  }
}
