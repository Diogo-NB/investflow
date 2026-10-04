import { CallHandler, ExecutionContext } from '@nestjs/common';
import { AppError, Result } from '@investflow/shared-domain';
import { firstValueFrom, of, throwError } from 'rxjs';
import { HttpResultInterceptor } from './http-result.interceptor';

const context = {} as ExecutionContext;

function intercept(response: unknown): Promise<unknown> {
  const next: CallHandler<unknown> = { handle: () => of(response) };
  return firstValueFrom(new HttpResultInterceptor().intercept(context, next));
}

describe('HttpResultInterceptor', () => {
  it('returns successful values without a Result envelope', async () => {
    const payload = { id: 'offer-id' };

    await expect(intercept(Result.ok(payload))).resolves.toBe(payload);
  });

  it('unwraps successful void results for no-content routes', async () => {
    await expect(intercept(Result.ok(undefined))).resolves.toBeUndefined();
  });

  it('throws the original AppError for the exception filter', async () => {
    const error = new AppError('Offer not found', {
      code: 'OFFER_NOT_FOUND',
      kind: 'not-found',
    });

    await expect(intercept(Result.err(error))).rejects.toBe(error);
  });

  it.each([
    undefined,
    null,
    false,
    0,
    'ok',
    { id: 'offer-id' },
    { value: 'ordinary data' },
  ])('passes ordinary responses through: %p', async (response) => {
    await expect(intercept(response)).resolves.toBe(response);
  });

  it('preserves exceptions already thrown by a route', async () => {
    const error = new Error('Unexpected failure');
    const next: CallHandler<unknown> = {
      handle: () => throwError(() => error),
    };

    await expect(
      firstValueFrom(new HttpResultInterceptor().intercept(context, next)),
    ).rejects.toBe(error);
  });
});
