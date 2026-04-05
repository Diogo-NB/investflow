import { AggregateRoot } from './aggregate-root.base';
import { DomainEvent } from '../domain-event/domain-event.interface';

class TestEvent implements DomainEvent {
  readonly eventId = crypto.randomUUID();
  readonly occurredAt = new Date();
  readonly eventType = 'TestEvent';
  readonly aggregateId = 'test-aggregate-id';
  readonly aggregateType = 'TestAggregate';
  readonly context = 'test-context';
  constructor(readonly payload: string) {}
}

class TestAggregate extends AggregateRoot {
  constructor() {
    const now = new Date();
    super('test-id', now, now);
  }

  doSomething(payload: string): void {
    this.apply(new TestEvent(payload));
  }
}

describe('AggregateRoot', () => {
  let aggregate: TestAggregate;

  beforeEach(() => {
    aggregate = new TestAggregate();
  });

  describe('getDomainEvents()', () => {
    it('returns empty array when no events have been applied', () => {
      expect(aggregate.getDomainEvents()).toEqual([]);
    });

    it('returns a copy — mutations do not affect the internal list', () => {
      aggregate.doSomething('first');
      const events = aggregate.getDomainEvents();
      events.pop();
      expect(aggregate.getDomainEvents()).toHaveLength(1);
    });

    it('accumulates multiple events in order', () => {
      aggregate.doSomething('first');
      aggregate.doSomething('second');
      const events = aggregate.getDomainEvents() as TestEvent[];
      expect(events).toHaveLength(2);
      expect(events[0].payload).toBe('first');
      expect(events[1].payload).toBe('second');
    });
  });

  describe('clearDomainEvents()', () => {
    it('empties the event list', () => {
      aggregate.doSomething('first');
      aggregate.clearDomainEvents();
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('is safe to call when no events exist', () => {
      expect(() => aggregate.clearDomainEvents()).not.toThrow();
    });
  });
});
