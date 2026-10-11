import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { PrismaService } from './prisma.service';
import { SKIP_TRANSACTION_KEY } from './skip-transaction.decorator';
import { TransactionContext } from './transaction.context';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipTransaction = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTransaction) {
      return next.handle();
    }

    return from(
      this.prisma.$transaction(async (tx) =>
        TransactionContext.run(
          tx,
          () =>
            new Promise<unknown>((resolve, reject) => {
              next.handle().subscribe({ next: resolve, error: reject });
            }),
        ),
      ),
    );
  }
}
