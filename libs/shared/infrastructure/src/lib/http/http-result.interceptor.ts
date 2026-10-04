import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Result } from '@investflow/shared-domain';
import { map, Observable } from 'rxjs';

@Injectable()
export class HttpResultInterceptor
  implements NestInterceptor<unknown, unknown>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((response: unknown) => {
        if (!(response instanceof Result)) return response;
        const result: Result<unknown> = response;
        if (result.isErr()) throw result.error;
        return result.value;
      }),
    );
  }
}
