import { DomainEvent } from './domain-event.contract';

export interface AggregateRootProps {
  readonly id: string;
}

export abstract class AggregateRoot {
  readonly id: string;

  private readonly _domainEvents: DomainEvent[] = [];

  protected constructor(id: string) {
    this.id = id;
  }

  protected apply(event: DomainEvent): this {
    this._domainEvents.push(event);
    return this;
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): this {
    this._domainEvents.length = 0;
    return this;
  }
}
