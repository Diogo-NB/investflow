import { AggregateRoot } from './aggregate-root.base';
import { Revision } from './revision';
import { DomainEvent } from './domain-event.contract';
import { UtcInstant } from '../dates/utc-instant.vo';
import { generateUuid } from '../identity/generate-uuid';

const OCCURRED_AT = UtcInstant.ofIso('2026-01-02T00:00:00Z');

class TestEvent implements DomainEvent {
  readonly eventId = generateUuid();
  readonly eventType = 'TestEvent';
  readonly version = 1;
  readonly aggregateId = 'test-aggregate-id';
  readonly aggregateType = 'TestAggregate';
  readonly context = 'test-context';
  constructor(
    readonly payload: string,
    readonly occurredAt: UtcInstant,
  ) {}
}

class TestAggregate extends AggregateRoot {
  constructor() {
    super('test-id');
  }

  doSomething(payload: string, at: UtcInstant = OCCURRED_AT): this {
    this.apply(new TestEvent(payload, at));
    return this;
  }
}

class RevisionedAggregate extends AggregateRoot {
  constructor(revision: Revision) {
    super('revisioned-id', revision);
  }

  change(): this {
    this.revisionTracker.increment();
    return this;
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

    it('stores event timestamps as immutable UTC instants', () => {
      aggregate.doSomething('first');

      expect(aggregate.getDomainEvents()[0].occurredAt).toBe(OCCURRED_AT);
    });
  });

  it('stores the aggregate identity', () => {
    expect(aggregate.id).toBe('test-id');
  });

  describe('markPersisted()', () => {
    it('empties the event list', () => {
      aggregate.doSomething('first');
      aggregate.markPersisted();
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('is safe to call when no events exist', () => {
      expect(() => aggregate.markPersisted()).not.toThrow();
    });
  });

  describe('revision', () => {
    it('starts the next revision once persisted', () => {
      const aggregate = new RevisionedAggregate(Revision.restore(2));

      aggregate.change().change();
      expect(aggregate.revision).toBe(3);

      aggregate.markPersisted().change();
      expect(aggregate.revision).toBe(4);
    });

    it('stays at 1 for an aggregate that does not track it', () => {
      aggregate.markPersisted();

      expect(aggregate.revision).toBe(1);
    });
  });
});
