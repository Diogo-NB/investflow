import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { IMessageBroker } from './message-broker.port';

@Injectable()
export class SnsMessageBroker implements IMessageBroker {
  private readonly logger = new Logger(SnsMessageBroker.name);
  private readonly snsClient: SNSClient;

  constructor(config: ConfigService) {
    this.snsClient = new SNSClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
  }

  async publish(topicArn: string, message: string): Promise<void> {
    await this.snsClient.send(new PublishCommand({ TopicArn: topicArn, Message: message }));
    this.logger.debug(`Published to ${topicArn}`);
  }
}
