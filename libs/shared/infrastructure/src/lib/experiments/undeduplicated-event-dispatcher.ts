import { DeduplicatingEventDispatcher } from '../messaging/consumers/deduplicating-event-dispatcher.service';

// Turns deduplication off: every delivery runs the handler, as if it were
// the first.
export class UndeduplicatedEventDispatcher extends DeduplicatingEventDispatcher {
  protected override async recordFirstDelivery(): Promise<boolean> {
    return true;
  }
}
