import {
  MessageBroker,
  type OutboxMessage,
} from '../../messaging/outbox/message-broker.port';
import { RejectUntilNewerMessageBroker } from '../reject-until-newer-message-broker';

function message(eventId: string, aggregateId: string): OutboxMessage {
  return {
    eventId,
    eventType: 'SimulationEdited',
    context: 'investment-simulator',
    payload: JSON.stringify({ eventId, aggregateId }),
  };
}

function createFixture() {
  const publish = jest.fn().mockResolvedValue([]);
  const broker = new RejectUntilNewerMessageBroker(
    { publish } as unknown as MessageBroker,
    { aggregateId: 'simulation-1', eventType: 'SimulationEdited', ordinal: 1 },
  );
  return { broker, publish };
}

const signal = new AbortController().signal;

describe('RejectUntilNewerMessageBroker', () => {
  it('rejects the target and publishes the rest', async () => {
    const { broker, publish } = createFixture();
    const other = message('event-other', 'simulation-2');

    const rejected = await broker.publish(
      [message('event-1', 'simulation-1'), other],
      signal,
    );

    expect(publish).toHaveBeenCalledWith([other], signal);
    expect(rejected).toEqual([expect.objectContaining({ eventId: 'event-1' })]);
  });

  it('keeps rejecting the target while no newer event of its aggregate was published', async () => {
    const { broker } = createFixture();
    await broker.publish([message('event-1', 'simulation-1')], signal);

    const rejected = await broker.publish(
      [message('event-1', 'simulation-1'), message('event-x', 'simulation-2')],
      signal,
    );

    expect(rejected).toEqual([expect.objectContaining({ eventId: 'event-1' })]);
  });

  it('publishes the target once a newer event of its aggregate was accepted', async () => {
    const { broker, publish } = createFixture();
    await broker.publish([message('event-1', 'simulation-1')], signal);
    await broker.publish([message('event-2', 'simulation-1')], signal);

    const rejected = await broker.publish(
      [message('event-1', 'simulation-1')],
      signal,
    );

    expect(rejected).toEqual([]);
    expect(publish).toHaveBeenLastCalledWith(
      [message('event-1', 'simulation-1')],
      signal,
    );
  });

  it('keeps holding the target when the newer event was rejected', async () => {
    const { broker, publish } = createFixture();
    await broker.publish([message('event-1', 'simulation-1')], signal);
    publish.mockResolvedValueOnce([
      { eventId: 'event-2', reason: 'throttled' },
    ]);
    await broker.publish([message('event-2', 'simulation-1')], signal);

    const rejected = await broker.publish(
      [message('event-1', 'simulation-1')],
      signal,
    );

    expect(rejected).toEqual([expect.objectContaining({ eventId: 'event-1' })]);
  });
});
