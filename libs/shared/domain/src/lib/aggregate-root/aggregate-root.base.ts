import { DomainEvent } from '../domain-event/domain-event.contract';
import { UtcInstant } from '../value-objects/utc-instant/utc-instant.vo';

export interface AggregateRootProps {
  id: string;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export abstract class AggregateRoot {
  readonly id: string;
  readonly createdAt: UtcInstant;
  protected updatedAt: UtcInstant;

  private readonly _domainEvents: DomainEvent[] = [];

  protected constructor(
    id: string,
    createdAt: UtcInstant,
    updatedAt: UtcInstant,
  ) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  getUpdatedAt(): UtcInstant {
    return this.updatedAt;
  }

  protected touch(at: UtcInstant): this {
    this.updatedAt = at;
    return this;
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
