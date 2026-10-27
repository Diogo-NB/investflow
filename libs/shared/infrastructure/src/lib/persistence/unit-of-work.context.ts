import { AsyncLocalStorage } from 'async_hooks';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';

export interface UnitOfWorkScope {
  readonly client: TransactionalPrismaClient;
  // Run in order inside the transaction once the work is done; a failure
  // rolls the transaction back.
  readonly beforeCommit: ((
    client: TransactionalPrismaClient,
  ) => Promise<void>)[];
  // Best effort: skipped on rollback, lost if the process stops after commit,
  // and run outside any unit of work. Work that must happen after a change
  // belongs in a domain event.
  readonly afterCommit: (() => void)[];
}

// The unit of work active in the current async context, if any.
export class UnitOfWorkContext {
  private static readonly storage = new AsyncLocalStorage<UnitOfWorkScope>();

  static run<T>(scope: UnitOfWorkScope, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(scope, fn);
  }

  static outside<T>(fn: () => T): T {
    return this.storage.exit(fn);
  }

  static current(): UnitOfWorkScope | undefined {
    return this.storage.getStore();
  }
}
