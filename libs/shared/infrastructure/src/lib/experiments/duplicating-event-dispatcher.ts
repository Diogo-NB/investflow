import { Logger } from '@nestjs/common';
import { EventDispatcher } from '../messaging/consumers/event-dispatcher';
import { ReceivedEvent } from '../messaging/consumers/received-event';
import { ExperimentTargetMatcher } from './experiment-target-matcher';
import type { ExperimentTarget } from './experiments.config';

// Delivers the target twice in a row, as a queue does when a consumer's
// delete is lost after it committed.
export class DuplicatingEventDispatcher extends EventDispatcher {
  private readonly logger = new Logger(DuplicatingEventDispatcher.name);
  private readonly matcher: ExperimentTargetMatcher;

  constructor(
    private readonly dispatcher: EventDispatcher,
    target: ExperimentTarget,
  ) {
    super();
    this.matcher = new ExperimentTargetMatcher(target);
  }

  async dispatch(consumer: object, event: ReceivedEvent): Promise<void> {
    await this.dispatcher.dispatch(consumer, event);
    const isTarget = this.matcher.matches({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.payload['aggregateId'],
    });
    if (!isTarget) return;

    this.logger.warn(
      `Experiment fault: delivering ${event.eventType} eventId=${event.eventId} again to ${consumer.constructor.name}`,
    );
    await this.dispatcher.dispatch(consumer, event);
  }
}
