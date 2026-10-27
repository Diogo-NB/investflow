import { EAppErrorCode } from '../app-error-code.enum';
import { AppError } from '../app.error';
import { ConflictError, DomainError, NotFoundError } from '../domain.error';

describe('AppError', () => {
  it('captures stable error data', () => {
    const cause = new Error('Cause');
    const error = new AppError('Falha.', {
      code: EAppErrorCode.REPOSITORY_FIND_FAILED,
      kind: 'external',
      metadata: { provider: 'example' },
      cause,
    });

    expect(error.name).toBe('AppError');
    expect(error.code).toBe(EAppErrorCode.REPOSITORY_FIND_FAILED);
    expect(error.kind).toBe('external');
    expect(error.metadata).toEqual({ provider: 'example' });
    expect(error.cause).toBe(cause);
  });

  it('defaults domain errors to validation kind', () => {
    const error = new DomainError('Estado inválido.', {
      code: EAppErrorCode.INVESTMENT_PERIOD_INVALID,
    });

    expect(error.kind).toBe('validation');
    expect(error.code).toBe(EAppErrorCode.INVESTMENT_PERIOD_INVALID);
  });

  it('sets standard not found and conflict kinds', () => {
    const options = { code: EAppErrorCode.OFFER_NOT_FOUND };
    expect(new NotFoundError('Não encontrado.', options).kind).toBe(
      'not-found',
    );
    expect(new ConflictError('Conflito.', options).kind).toBe('conflict');
  });
});
