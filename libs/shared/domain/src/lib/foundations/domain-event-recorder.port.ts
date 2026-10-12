import type { DomainEvent } from './domain-event.contract';

// Events recorded here are saved with the changes of the current unit of
// work: both commit, or neither does. Aggregates raise events through
// apply() and their repository records them on save; domain and application
// services record directly.
export abstract class DomainEventRecorder {
  abstract record(...events: DomainEvent[]): void;
}
