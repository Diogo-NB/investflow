import { AsyncLocalStorage } from 'async_hooks';
import { TransactionalPrismaClient } from './prisma-client.type';

export class TransactionContext {
  private static readonly storage =
    new AsyncLocalStorage<TransactionalPrismaClient>();

  static run<T>(
    client: TransactionalPrismaClient,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run(client, fn);
  }

  static get(): TransactionalPrismaClient | undefined {
    return this.storage.getStore();
  }
}
