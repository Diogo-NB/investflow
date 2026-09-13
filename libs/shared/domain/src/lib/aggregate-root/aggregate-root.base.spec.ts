import { AggregateRoot } from './aggregate-root.base';
import { DomainEvent } from '../domain-event/domain-event.contract';
import { UtcInstant } from '../value-objects/utc-instant/utc-instant.vo';

const CREATED_AT = UtcInstant.ofIso('2026-01-01T00:00:00Z');
const UPDATED_AT = UtcInstant.ofIso('2026-01-02T00:00:00Z');

class TestEvent implements DomainEvent {
  readonly eventId = crypto.randomUUID();
  readonly occurredAt: string;
  readonly eventType = 'TestEvent';
  readonly version = 1;
  readonly aggregateId = 'test-aggregate-id';
  readonly aggregateType = 'TestAggregate';
  readonly context = 'test-context';
  constructor(
    readonly payload: string,
    occurredAt: UtcInstant,
  ) {
    this.occurredAt = occurredAt.toISOString();
  }
}

class TestAggregate extends AggregateRoot {
  constructor() {
    super('test-id', CREATED_AT, CREATED_AT);
  }

  doSomething(payload: string, at: UtcInstant = UPDATED_AT): this {
    this.apply(new TestEvent(payload, at));
    return this.touch(at);
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

    it('stores event timestamps as canonical scalar strings', () => {
      aggregate.doSomething('first');

      expect(aggregate.getDomainEvents()[0].occurredAt).toBe(
        '2026-01-02T00:00:00.000Z',
      );
    });
  });

  it('stores aggregate timestamps as immutable UTC instants', () => {
    expect(aggregate.createdAt).toBe(CREATED_AT);
    expect(aggregate.getUpdatedAt()).toBe(CREATED_AT);

    aggregate.doSomething('first', UPDATED_AT);

    expect(aggregate.getUpdatedAt()).toBe(UPDATED_AT);
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
