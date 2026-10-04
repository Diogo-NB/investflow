import { Test, TestingModule } from '@nestjs/testing';
import { ExternalContextCreator } from '@nestjs/core/helpers/external-context-creator';
import { AppError, Result } from '@investflow/shared-domain';
import {
  PrismaService,
  SkipTransaction,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { HTTP_INTERCEPTOR_PROVIDERS } from './http-interceptors.providers';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

class RouteFixture {
  response: unknown;
  readonly trace: string[] = [];

  route(): unknown {
    this.trace.push('route');
    return this.response;
  }

  @SkipTransaction()
  skippedRoute(): unknown {
    return this.route();
  }
}

describe('API global HTTP interceptors', () => {
  let module: TestingModule;
  let fixture: RouteFixture;
  let transaction: jest.Mock;

  beforeEach(async () => {
    fixture = new RouteFixture();
    transaction = jest.fn(
      async (work: (client: TransactionalPrismaClient) => Promise<unknown>) => {
        fixture.trace.push('begin');
        try {
          const result = await work({} as TransactionalPrismaClient);
          fixture.trace.push('commit');
          return result;
        } catch (error) {
          fixture.trace.push('rollback');
          throw error;
        }
      },
    );
    module = await Test.createTestingModule({
      providers: [
        ...HTTP_INTERCEPTOR_PROVIDERS,
        { provide: PrismaService, useValue: { $transaction: transaction } },
        { provide: RouteFixture, useValue: fixture },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  function invoke(
    method: 'route' | 'skippedRoute' = 'route',
  ): Promise<unknown> {
    // Run Nest's registered global pipeline without opening a socket or database.
    const context = module.get(ExternalContextCreator);
    const handler = context.create(
      fixture,
      fixture[method],
      method,
      undefined,
      undefined,
      undefined,
      undefined,
      { interceptors: true, guards: false, filters: false },
      'http',
    );
    return handler();
  }

  it('unwraps successful results and commits the transaction', async () => {
    const payload = { id: 'offer-id' };
    fixture.response = Result.ok(payload);

    await expect(invoke()).resolves.toBe(payload);
    expect(fixture.trace).toEqual(['begin', 'route', 'commit']);
  });

  it('rolls back failed results before forwarding the original error', async () => {
    const error = new AppError('Offer not found', {
      code: 'OFFER_NOT_FOUND',
      kind: 'not-found',
    });
    fixture.response = Result.err(error);

    await expect(invoke()).rejects.toBe(error);
    expect(fixture.trace).toEqual(['begin', 'route', 'rollback']);
  });

  it('unwraps results even when the transaction is skipped', async () => {
    fixture.response = Result.ok(undefined);

    await expect(invoke('skippedRoute')).resolves.toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();
    expect(fixture.trace).toEqual(['route']);
  });

  it('forwards failed results even when the transaction is skipped', async () => {
    const error = new AppError('Invalid input', {
      code: 'INVALID_INPUT',
      kind: 'validation',
    });
    fixture.response = Result.err(error);

    await expect(invoke('skippedRoute')).rejects.toBe(error);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('preserves ordinary responses from other controllers', async () => {
    const payload = { status: 'ok' };
    fixture.response = payload;

    await expect(invoke()).resolves.toBe(payload);
    expect(fixture.trace).toEqual(['begin', 'route', 'commit']);
  });
});
