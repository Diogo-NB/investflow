import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { EventBridgeMessageBroker } from './eventbridge-message-broker';

const messages = ['event-1', 'event-2', 'event-3'].map((eventId) => ({
  eventId,
  eventType: 'TestHappened',
  context: 'test-context',
  payload: `{"eventId":"${eventId}"}`,
}));

function createBroker() {
  const config = {
    getOrThrow: (key: string) =>
      ({ AWS_REGION: 'us-east-1', EVENT_BUS_NAME: 'investflow' })[key],
  } as unknown as ConfigService;
  return new EventBridgeMessageBroker(config);
}

describe('EventBridgeMessageBroker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('puts the batch in one call, routed by context and event type', async () => {
    const send = jest
      .spyOn(EventBridgeClient.prototype, 'send')
      .mockResolvedValue({
        FailedEntryCount: 0,
        Entries: messages.map((_, index) => ({ EventId: `eb-${index}` })),
      } as never);
    const signal = new AbortController().signal;

    const rejected = await createBroker().publish(messages, signal);

    expect(rejected).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
    const [command, options] = send.mock.calls[0] as unknown as [
      PutEventsCommand,
      { abortSignal: AbortSignal },
    ];
    expect(command.input.Entries?.[0]).toEqual({
      EventBusName: 'investflow',
      Source: 'investflow.test-context',
      DetailType: 'TestHappened',
      Detail: messages[0].payload,
    });
    expect(command.input.Entries).toHaveLength(3);
    expect(options.abortSignal).toBe(signal);
  });

  it('reports the entries EventBridge rejected', async () => {
    jest.spyOn(EventBridgeClient.prototype, 'send').mockResolvedValue({
      FailedEntryCount: 1,
      Entries: [
        { EventId: 'eb-0' },
        { ErrorCode: 'InternalFailure', ErrorMessage: 'boom' },
        { EventId: 'eb-2' },
      ],
    } as never);

    const rejected = await createBroker().publish(
      messages,
      new AbortController().signal,
    );

    expect(rejected).toEqual([
      {
        eventId: 'event-2',
        reason: 'EventBridge rejected the event: InternalFailure boom',
      },
    ]);
  });

  it('fails when the call fails', async () => {
    jest
      .spyOn(EventBridgeClient.prototype, 'send')
      .mockRejectedValue(new Error('network down') as never);

    await expect(
      createBroker().publish(messages, new AbortController().signal),
    ).rejects.toThrow('network down');
  });
});
