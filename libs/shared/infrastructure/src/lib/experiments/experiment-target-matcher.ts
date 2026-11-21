import { ExperimentTarget } from './experiments.config';

// Counts distinct events of the target's aggregate and type since the host
// started, so redeliveries of an earlier event do not move the ordinal. The
// first match pins its event ID: a fault that repeats on every receive keeps
// hitting the same event.
export class ExperimentTargetMatcher {
  private readonly seenEventIds = new Set<string>();
  private pinnedEventId: string | undefined;

  constructor(private readonly target: ExperimentTarget | undefined) {}

  matches(event: {
    readonly eventId: string;
    readonly eventType: string;
    readonly aggregateId: unknown;
  }): boolean {
    if (!this.target) return false;
    if (this.pinnedEventId !== undefined) {
      return event.eventId === this.pinnedEventId;
    }
    if (
      event.eventType !== this.target.eventType ||
      event.aggregateId !== this.target.aggregateId
    ) {
      return false;
    }

    this.seenEventIds.add(event.eventId);
    if (this.seenEventIds.size !== this.target.ordinal) return false;
    this.pinnedEventId = event.eventId;
    return true;
  }
}
