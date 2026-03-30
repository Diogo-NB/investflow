import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TransactionalPrismaClient } from './prisma-client.type';
import { TransactionContext } from './transaction.context';

const TRANSACTION_TIMEOUT = 10_000;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly _client: PrismaClient;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });

    const adapter = new PrismaPg(this.pool);

    this._client = new PrismaClient({
      adapter,
      log:
        config.get('NODE_ENV') === 'production'
          ? ['error', 'warn']
          : ['error', 'warn', 'query'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this._client.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this._client.$disconnect();
    await this.pool.end();
    this.logger.log('Disconnected from database');
  }

  get client(): TransactionalPrismaClient {
    return TransactionContext.get() ?? this._client;
  }

  async isHealthy(): Promise<boolean> {
    await this._client.$queryRaw`SELECT 1`;
    return true;
  }

  $transaction<T>(
    fn: (tx: TransactionalPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this._client.$transaction(fn, { timeout: TRANSACTION_TIMEOUT });
  }
}
