import { AppError, AppErrorOptions } from './app.error';

export type DomainErrorOptions = Omit<AppErrorOptions, 'kind'> &
  Partial<Pick<AppErrorOptions, 'kind'>>;

export class DomainError extends AppError {
  constructor(message: string, options: DomainErrorOptions) {
    super(message, { ...options, kind: options.kind ?? 'validation' });
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, options: DomainErrorOptions) {
    super(message, { ...options, kind: options.kind ?? 'not-found' });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, options: DomainErrorOptions) {
    super(message, { ...options, kind: options.kind ?? 'conflict' });
  }
}
