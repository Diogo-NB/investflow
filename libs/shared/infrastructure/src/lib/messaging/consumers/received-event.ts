export interface ReceivedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}
