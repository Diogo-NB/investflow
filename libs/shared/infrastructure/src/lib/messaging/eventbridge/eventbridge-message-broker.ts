import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { MessageBroker, OutboxMessage } from '../outbox/message-broker.port';

@Injectable()
export class EventBridgeMessageBroker extends MessageBroker {
  private readonly client: EventBridgeClient;
  private readonly eventBusName: string;

  constructor(config: ConfigService) {
    super();
    this.client = new EventBridgeClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
    this.eventBusName = config.getOrThrow<string>('EVENT_BUS_NAME');
  }

  async publish(message: OutboxMessage): Promise<void> {
    const response = await this.client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.eventBusName,
            Source: `investflow.${message.context}`,
            DetailType: message.eventType,
            Detail: message.payload,
          },
        ],
      }),
    );

    // PutEvents reports rejected entries in a successful response.
    if (response.FailedEntryCount) {
      const entry = response.Entries?.[0];
      throw new Error(
        `EventBridge rejected event ${message.eventId}: ${entry?.ErrorCode} ${entry?.ErrorMessage}`,
      );
    }
  }
}
