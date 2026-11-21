import { EventDispatcher } from '../../messaging/consumers/event-dispatcher';
import { ReceivedEvent } from '../../messaging/consumers/received-event';
import { DeadLetteringEventDispatcher } from '../dead-lettering-event-dispatcher';
import { DuplicatingEventDispatcher } from '../duplicating-event-dispatcher';

class CalculationConsumer {}
class FailureConsumer {}

const target = {
  aggregateId: 'simulation-1',
  eventType: 'SimulationEdited',
  ordinal: 1,
};

function received(
  eventId: string,
  aggregateId = 'simulation-1',
): ReceivedEvent {
  return {
    eventId,
    eventType: 'SimulationEdited',
    payload: { eventId, aggregateId },
  };
}

function createInner() {
  const dispatch = jest.fn().mockResolvedValue(undefined);
  return { inner: { dispatch } as unknown as EventDispatcher, dispatch };
}

describe('DeadLetteringEventDispatcher', () => {
  it('fails every receive of the target', async () => {
    const { inner, dispatch } = createInner();
    const dispatcher = new DeadLetteringEventDispatcher(inner, target);
    const consumer = new CalculationConsumer();

    await expect(
      dispatcher.dispatch(consumer, received('event-1')),
    ).rejects.toThrow('Experiment fault');
    await expect(
      dispatcher.dispatch(consumer, received('event-1')),
    ).rejects.toThrow('Experiment fault');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('lets the dead-letter consumer receive the target', async () => {
    const { inner, dispatch } = createInner();
    const dispatcher = new DeadLetteringEventDispatcher(inner, target);
    await expect(
      dispatcher.dispatch(new CalculationConsumer(), received('event-1')),
    ).rejects.toThrow('Experiment fault');
    const failureConsumer = new FailureConsumer();

    await dispatcher.dispatch(failureConsumer, received('event-1'));

    expect(dispatch).toHaveBeenCalledWith(failureConsumer, received('event-1'));
  });

  it('passes other events through', async () => {
    const { inner, dispatch } = createInner();
    const dispatcher = new DeadLetteringEventDispatcher(inner, target);
    const consumer = new CalculationConsumer();

    await dispatcher.dispatch(consumer, received('event-x', 'simulation-2'));

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('DuplicatingEventDispatcher', () => {
  it('delivers the target twice', async () => {
    const { inner, dispatch } = createInner();
    const dispatcher = new DuplicatingEventDispatcher(inner, target);
    const consumer = new CalculationConsumer();

    await dispatcher.dispatch(consumer, received('event-1'));

    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('delivers other events once', async () => {
    const { inner, dispatch } = createInner();
    const dispatcher = new DuplicatingEventDispatcher(inner, target);

    await dispatcher.dispatch(
      new CalculationConsumer(),
      received('event-x', 'simulation-2'),
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not deliver the target twice when the first delivery failed', async () => {
    const { inner, dispatch } = createInner();
    dispatch.mockRejectedValueOnce(new Error('handler failed'));
    const dispatcher = new DuplicatingEventDispatcher(inner, target);

    await expect(
      dispatcher.dispatch(new CalculationConsumer(), received('event-1')),
    ).rejects.toThrow('handler failed');

    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
