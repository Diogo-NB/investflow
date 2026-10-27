export interface OutboxMessage {
  readonly eventId: string;
  readonly eventType: string;
  readonly context: string;
  readonly payload: string;
}

export interface RejectedMessage {
  readonly eventId: string;
  readonly reason: string;
}

// The outbox sends batches of at most this many messages and bytes (payload,
// event type, and context), so every broker adapter must accept them.
export const MAX_BATCH_MESSAGES = 10;
export const MAX_BATCH_BYTES = 240 * 1024;

export abstract class MessageBroker {
  // Resolves with the messages the broker rejected, and rejects when the
  // whole batch failed. The outbox owns retries, so adapters must not retry
  // and must stop when the signal aborts.
  abstract publish(
    messages: readonly OutboxMessage[],
    signal: AbortSignal,
  ): Promise<readonly RejectedMessage[]>;
}
