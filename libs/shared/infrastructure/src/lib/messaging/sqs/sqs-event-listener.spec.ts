import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EventDispatcher } from '../consumers/event-dispatcher.service';
import { SqsEventListener } from './sqs-event-listener';

const detail = { eventId: 'event-1', eventType: 'TestHappened', value: 1 };
const consumer = {};

function message(body: string) {
  return { MessageId: 'message-1', ReceiptHandle: 'receipt-1', Body: body };
}

function eventBridgeBody(eventDetail: unknown = detail) {
  return JSON.stringify({ 'detail-type': 'TestHappened', detail: eventDetail });
}

function createFixture() {
  const send = jest.fn().mockResolvedValue({});
  const dispatch = jest.fn().mockResolvedValue(undefined);
  const listener = new SqsEventListener(
    { send } as unknown as SQSClient,
    'queue-url',
    consumer,
    { dispatch } as unknown as EventDispatcher,
  );
  return { listener, send, dispatch };
}

describe('SqsEventListener', () => {
  it('dispatches the EventBridge detail and deletes the message', async () => {
    const { listener, send, dispatch } = createFixture();

    await listener.process(message(eventBridgeBody()));

    expect(dispatch).toHaveBeenCalledWith(consumer, {
      eventId: 'event-1',
      eventType: 'TestHappened',
      payload: detail,
    });
    const command = send.mock.calls[0][0] as DeleteMessageCommand;
    expect(command.input).toEqual({
      QueueUrl: 'queue-url',
      ReceiptHandle: 'receipt-1',
    });
  });

  it('keeps the message for retry when handling fails', async () => {
    const { listener, send, dispatch } = createFixture();
    dispatch.mockRejectedValueOnce(new Error('handler failed'));

    await listener.process(message(eventBridgeBody()));

    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['no detail', JSON.stringify({ source: 'x' })],
    ['no event ID', eventBridgeBody({ eventType: 'TestHappened' })],
  ])('leaves a message with %s for the dead-letter queue', async (_, body) => {
    const { listener, send, dispatch } = createFixture();

    await listener.process(message(body));

    expect(dispatch).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
