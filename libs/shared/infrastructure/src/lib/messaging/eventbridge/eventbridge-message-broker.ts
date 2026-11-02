import { Inject, Injectable } from '@nestjs/common';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { awsConfig, type AwsConfig } from '../../aws/aws.config';
import {
  MessageBroker,
  OutboxMessage,
  RejectedMessage,
} from '../outbox/message-broker.port';
import {
  eventBridgeConfig,
  type EventBridgeConfig,
} from './eventbridge.config';

@Injectable()
export class EventBridgeMessageBroker extends MessageBroker {
  private readonly client: EventBridgeClient;
  private readonly eventBusName: string;

  constructor(
    @Inject(awsConfig.KEY) aws: AwsConfig,
    @Inject(eventBridgeConfig.KEY) eventBridge: EventBridgeConfig,
  ) {
    super();
    this.client = new EventBridgeClient({
      region: aws.region,
      maxAttempts: 1,
    });
    this.eventBusName = eventBridge.eventBusName;
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
