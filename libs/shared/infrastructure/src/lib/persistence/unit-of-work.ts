import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { UnitOfWorkContext, UnitOfWorkScope } from './unit-of-work.context';

// One transaction whose changes and recorded domain events commit together.
// Every writing entry point (HTTP requests, consumers, seed) runs inside one.
@Injectable()
export class UnitOfWork {
  private readonly logger = new Logger(UnitOfWork.name);

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const afterCommit: (() => void)[] = [];
    const result = await this.prisma.$transaction(async (client) => {
      const scope: UnitOfWorkScope = { client, beforeCommit: [], afterCommit };
      const value = await UnitOfWorkContext.run(scope, fn);
      for (const hook of scope.beforeCommit) await hook(client);
      return value;
    });

    UnitOfWorkContext.outside(() => {
      for (const hook of afterCommit) {
        try {
          hook();
        } catch (error) {
          this.logger.error('After-commit hook failed', error);
        }
      }
    });
    return result;
  }

  // Best effort, like every after-commit hook (see UnitOfWorkScope).
  afterCommit(hook: () => void): void {
    const scope = UnitOfWorkContext.current();
    if (!scope) {
      throw new Error('After-commit hooks need a unit of work to commit');
    }
    scope.afterCommit.push(hook);
  }
}
