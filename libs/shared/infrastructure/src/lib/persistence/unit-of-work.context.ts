import { AsyncLocalStorage } from 'async_hooks';
import type { OutboxRow } from '../messaging/outbox/outbox-writer';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';

export interface UnitOfWorkScope {
  readonly client: TransactionalPrismaClient;
  // Recorded events, already validated, written to the outbox before commit.
  readonly outboxRows: OutboxRow[];
}

// The unit of work active in the current async context, if any.
export class UnitOfWorkContext {
  private static readonly storage = new AsyncLocalStorage<UnitOfWorkScope>();

  static run<T>(scope: UnitOfWorkScope, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(scope, fn);
  }

  static current(): UnitOfWorkScope | undefined {
    return this.storage.getStore();
  }
}
