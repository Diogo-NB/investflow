import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  MessageBroker,
  OutboxMessage,
  RejectedMessage,
} from '../outbox/message-broker.port';

@Injectable()
export class EventBridgeMessageBroker extends MessageBroker {
  private readonly client: EventBridgeClient;
  private readonly eventBusName: string;

  constructor(config: ConfigService) {
    super();
    this.client = new EventBridgeClient({
      region: config.getOrThrow<string>('AWS_REGION'),
      maxAttempts: 1,
    });
    this.eventBusName = config.getOrThrow<string>('EVENT_BUS_NAME');
  }

  async publish(
    messages: readonly OutboxMessage[],
    signal: AbortSignal,
  ): Promise<readonly RejectedMessage[]> {
    const response = await this.client.send(
      new PutEventsCommand({
        Entries: messages.map((message) => ({
          EventBusName: this.eventBusName,
          Source: `investflow.${message.context}`,
          DetailType: message.eventType,
          Detail: message.payload,
        })),
      }),
      { abortSignal: signal },
    );
    if (!response.FailedEntryCount) return [];

    // PutEvents reports rejected entries in a successful response, in request
    // order; only accepted entries carry an EventId.
    return messages.flatMap((message, index) => {
      const entry = response.Entries?.[index];
      if (entry?.EventId) return [];
      return [
        {
          eventId: message.eventId,
          reason: `EventBridge rejected the event: ${entry?.ErrorCode} ${entry?.ErrorMessage}`,
        },
      ];
    });
  }
}
