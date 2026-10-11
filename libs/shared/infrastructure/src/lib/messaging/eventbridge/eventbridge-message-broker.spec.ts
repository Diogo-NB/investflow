import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { EventBridgeMessageBroker } from './eventbridge-message-broker';

const message = {
  eventId: 'event-1',
  eventType: 'TestHappened',
  context: 'test-context',
  payload: '{"eventId":"event-1"}',
};

function createBroker() {
  const config = {
    getOrThrow: (key: string) =>
      ({ AWS_REGION: 'us-east-1', EVENT_BUS_NAME: 'investflow' })[key],
  } as unknown as ConfigService;
  return new EventBridgeMessageBroker(config);
}

describe('EventBridgeMessageBroker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('routes the event by context and event type on the configured bus', async () => {
    const send = jest
      .spyOn(EventBridgeClient.prototype, 'send')
      .mockResolvedValue({ FailedEntryCount: 0, Entries: [{}] } as never);

    await createBroker().publish(message);

    const command = send.mock.calls[0][0] as PutEventsCommand;
    expect(command.input.Entries).toEqual([
      {
        EventBusName: 'investflow',
        Source: 'investflow.test-context',
        DetailType: 'TestHappened',
        Detail: message.payload,
      },
    ]);
  });

  it('fails when EventBridge rejects the entry', async () => {
    jest.spyOn(EventBridgeClient.prototype, 'send').mockResolvedValue({
      FailedEntryCount: 1,
      Entries: [{ ErrorCode: 'InternalFailure', ErrorMessage: 'boom' }],
    } as never);

    await expect(createBroker().publish(message)).rejects.toThrow(
      'EventBridge rejected event event-1: InternalFailure boom',
    );
  });
});
