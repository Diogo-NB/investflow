export type AppErrorKind =
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'external'
  | 'infrastructure'
  | 'unexpected';

export type AppErrorMetadata = Readonly<Record<string, unknown>>;

export interface AppErrorOptions {
  readonly code?: string;
  readonly kind: AppErrorKind;
  readonly metadata?: AppErrorMetadata;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly kind: AppErrorKind;
  readonly metadata?: AppErrorMetadata;

  constructor(message: string, options: AppErrorOptions) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = this.constructor.name;
    this.code = options.code ?? this.constructor.name;
    this.kind = options.kind;
    this.metadata = options.metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
