import { Injectable, Optional } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { DomainEvent, DomainEventRecorder } from '@investflow/shared-domain';
import {
  UnitOfWorkContext,
  UnitOfWorkScope,
} from '../../persistence/unit-of-work.context';
import { OutboxRelay } from './outbox-relay';
import { OutboxRow, OutboxWriter } from './outbox-writer';

// Without a relay (a host that does not import OutboxModule), recorded events
// wait for a publishing host's poller.
@Injectable()
export class TransactionalDomainEventRecorder extends DomainEventRecorder {
  private readonly outbox = new OutboxWriter();
  private readonly rowsByScope = new WeakMap<UnitOfWorkScope, OutboxRow[]>();

  constructor(
    private readonly clock: Clock,
    @Optional() private readonly relay?: OutboxRelay,
  ) {
    super();
  }

  // Validates immediately, so an event the outbox would reject fails where it
  // is raised rather than at commit.
  record(...events: DomainEvent[]): void {
    const scope = UnitOfWorkContext.current();
    if (!scope) {
      throw new Error(
        `Events recorded outside a unit of work would be lost: ${events.map((event) => event.eventType).join(', ')}`,
      );
    }
    const rows = this.outbox.prepare(events);
    const recorded = this.rowsByScope.get(scope);
    if (recorded) {
      recorded.push(...rows);
      return;
    }

    this.rowsByScope.set(scope, rows);
    scope.beforeCommit.push((client) => {
      // Stamped as the transaction ends rather than when it began, so the
      // poller's grace period counts from about the commit.
      const createdAt = this.clock.now().date;
      return this.outbox.append(
        client,
        rows.map((row) => ({ ...row, createdAt })),
      );
    });
    scope.afterCommit.push(() => this.relay?.enqueue(rows));
  }
}
