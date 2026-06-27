import { AppError, AppErrorOptions } from './app.error';

export type DomainErrorOptions = Partial<AppErrorOptions>;

export class DomainError extends AppError {
  constructor(message: string, options: DomainErrorOptions = {}) {
    super(message, {
      code: options.code,
      kind: options.kind ?? 'validation',
      metadata: options.metadata,
      cause: options.cause,
    });
  }
}

export class NotFoundError extends DomainError {
  constructor(
    message = 'Resource not found',
    options: DomainErrorOptions = {},
  ) {
    super(message, { ...options, kind: options.kind ?? 'not-found' });
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource conflict', options: DomainErrorOptions = {}) {
    super(message, { ...options, kind: options.kind ?? 'conflict' });
  }
}
