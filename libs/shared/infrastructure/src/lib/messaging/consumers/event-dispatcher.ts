import { ReceivedEvent } from './received-event';

// The SQS listener calls it once per receive; a rejection leaves the message
// on the queue for redelivery.
export abstract class EventDispatcher {
  abstract dispatch(consumer: object, event: ReceivedEvent): Promise<void>;
}
