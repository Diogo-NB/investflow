import { OutboxTopicRegistry } from './outbox-topic.registry';

describe('OutboxTopicRegistry', () => {
  let registry: OutboxTopicRegistry;

  beforeEach(() => {
    registry = new OutboxTopicRegistry();
  });

  it('registers and resolves a topic ARN by context', () => {
    registry.register(
      'example-context',
      'arn:aws:sns:us-east-1:000000000000:example',
    );

    expect(registry.resolve('example-context')).toBe(
      'arn:aws:sns:us-east-1:000000000000:example',
    );
  });

  it('returns undefined for an unregistered context', () => {
    expect(registry.resolve('missing-context')).toBeUndefined();
  });

  it('rejects conflicting registrations for the same context', () => {
    registry.register('example-context', 'arn:first');

    expect(() => registry.register('example-context', 'arn:second')).toThrow(
      'Outbox topic already registered for context "example-context"',
    );
  });

  it('allows an identical registration to be repeated', () => {
    registry.register('example-context', 'arn:example');

    expect(() =>
      registry.register('example-context', 'arn:example'),
    ).not.toThrow();
  });
});
