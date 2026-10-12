import { DomainEvent } from './domain-event.contract';
import { Revision } from './revision';

export interface AggregateRootProps {
  readonly id: string;
}

export abstract class AggregateRoot {
  readonly id: string;

  private readonly _domainEvents: DomainEvent[] = [];

  // Aggregates numbered for optimistic concurrency pass their revision;
  // the others keep a fixed one.
  protected constructor(
    id: string,
    protected readonly revisionTracker: Revision = Revision.fixed(),
  ) {
    this.id = id;
  }

  get revision(): number {
    return this.revisionTracker.value;
  }

  protected apply(event: DomainEvent): this {
    this._domainEvents.push(event);
    return this;
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  // Called by the repository once the aggregate and its events are saved, so
  // the next change takes a new revision.
  markPersisted(): this {
    this._domainEvents.length = 0;
    this.revisionTracker.markPersisted();
    return this;
  }
}
