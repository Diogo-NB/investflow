import { Injectable } from '@nestjs/common';
import { DomainEvent, DomainEventRecorder } from '@investflow/shared-domain';
import { UnitOfWorkContext } from '../../persistence/unit-of-work.context';
import { OutboxWriter } from './outbox-writer';

@Injectable()
export class TransactionalDomainEventRecorder extends DomainEventRecorder {
  private readonly outbox = new OutboxWriter();

  // Validates immediately, so an event the outbox would reject fails where it
  // is raised rather than at commit.
  record(...events: DomainEvent[]): void {
    const scope = UnitOfWorkContext.current();
    if (!scope) {
      throw new Error(
        `Events recorded outside a unit of work would be lost: ${events.map((event) => event.eventType).join(', ')}`,
      );
    }
    scope.outboxRows.push(...this.outbox.prepare(events));
  }
}
