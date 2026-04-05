import { Injectable, Logger } from '@nestjs/common';
import type { IMessageBroker } from './message-broker.port';

@Injectable()
export class ConsoleMessageBroker implements IMessageBroker {
  private readonly logger = new Logger(ConsoleMessageBroker.name);

  async publish(topicArn: string, message: string): Promise<void> {
    this.logger.log(`[OUTBOX] topic=${topicArn} message=${message}`);
  }
}
