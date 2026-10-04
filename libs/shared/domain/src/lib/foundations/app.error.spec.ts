import { AppError } from './app.error';
import { ConflictError, DomainError, NotFoundError } from './domain.error';

describe('AppError', () => {
  it('captures stable error data', () => {
    const cause = new Error('Cause');
    const error = new AppError('Failure', {
      code: 'FAILURE',
      kind: 'external',
      metadata: { provider: 'example' },
      cause,
    });

    expect(error.name).toBe('AppError');
    expect(error.code).toBe('FAILURE');
    expect(error.kind).toBe('external');
    expect(error.metadata).toEqual({ provider: 'example' });
    expect(error.cause).toBe(cause);
  });

  it('defaults domain errors to validation kind', () => {
    const error = new DomainError('Invalid domain state');

    expect(error.kind).toBe('validation');
    expect(error.code).toBe('DomainError');
  });

  it('sets standard not found and conflict kinds', () => {
    expect(new NotFoundError().kind).toBe('not-found');
    expect(new ConflictError().kind).toBe('conflict');
  });
});
