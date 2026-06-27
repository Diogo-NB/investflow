export abstract class MessageBroker {
  abstract publish(topicArn: string, message: string): Promise<void>;
}
