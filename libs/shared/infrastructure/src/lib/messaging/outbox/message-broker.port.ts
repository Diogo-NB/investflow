export interface OutboxMessage {
  readonly eventId: string;
  readonly eventType: string;
  readonly context: string;
  readonly payload: string;
}

export abstract class MessageBroker {
  abstract publish(message: OutboxMessage): Promise<void>;
}
