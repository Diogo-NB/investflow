import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { SKIP_TRANSACTION_KEY } from './skip-transaction.decorator';
import { UnitOfWork } from '../unit-of-work';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly unitOfWork: UnitOfWork,
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
      this.unitOfWork.run(
        () =>
          new Promise<unknown>((resolve, reject) => {
            next.handle().subscribe({ next: resolve, error: reject });
          }),
      ),
    );
  }
}
