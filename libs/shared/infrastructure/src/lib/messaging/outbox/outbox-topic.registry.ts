import { Injectable } from '@nestjs/common';

@Injectable()
export class OutboxTopicRegistry {
  private readonly topicArnByContext = new Map<string, string>();

  register(context: string, topicArn: string): void {
    const registeredTopicArn = this.topicArnByContext.get(context);
    if (registeredTopicArn === topicArn) return;

    if (registeredTopicArn) {
      throw new Error(
        `Outbox topic already registered for context "${context}"`,
      );
    }

    this.topicArnByContext.set(context, topicArn);
  }

  resolve(context: string): string | undefined {
    return this.topicArnByContext.get(context);
  }
}
