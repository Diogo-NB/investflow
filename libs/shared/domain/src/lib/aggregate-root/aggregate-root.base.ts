import { DomainEvent } from '../domain-event/domain-event.interface';

export interface AggregateRootProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class AggregateRoot {
  readonly id: string;
  readonly createdAt: Date;
  protected updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  protected constructor(id: string, createdAt: Date, updatedAt: Date) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
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
