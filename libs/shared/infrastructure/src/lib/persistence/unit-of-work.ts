import { Injectable } from '@nestjs/common';
import { OutboxWriter } from '../messaging/outbox/outbox-writer';
import { PrismaService } from './prisma/prisma.service';
import { UnitOfWorkContext } from './unit-of-work.context';

// One transaction whose changes and recorded domain events commit together.
// Every writing entry point (HTTP requests, consumers, seed) runs inside one.
@Injectable()
export class UnitOfWork {
  private readonly outbox = new OutboxWriter();

  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (client) => {
      const scope = { client, outboxRows: [] };
      const result = await UnitOfWorkContext.run(scope, fn);
      await this.outbox.append(client, scope.outboxRows);
      return result;
    });
  }
}
