export interface IMessageBroker {
  publish(topicArn: string, message: string): Promise<void>;
}

export const MESSAGE_BROKER = Symbol('IMessageBroker');
