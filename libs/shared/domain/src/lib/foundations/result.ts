import { AppError } from './app.error';

type ResultState<T, E extends AppError> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'err'; readonly error: E };

export class Result<T, E extends AppError = AppError> {
  private constructor(private readonly state: ResultState<T, E>) {}

  static ok<T, E extends AppError = AppError>(value: T): Result<T, E> {
    return new Result<T, E>({ status: 'ok', value });
  }

  static err<T = never, E extends AppError = AppError>(error: E): Result<T, E> {
    return new Result<T, E>({ status: 'err', error });
  }

  static fromThrowable<T, E extends AppError>(
    operation: () => T,
    mapError: (error: unknown) => E,
  ): Result<T, E> {
    try {
      return Result.ok<T, E>(operation());
    } catch (error) {
      return Result.err<T, E>(mapError(error));
    }
  }

  static async fromPromise<T, E extends AppError>(
    operation: () => Promise<T>,
    mapError: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      return Result.ok<T, E>(await operation());
    } catch (error) {
      return Result.err<T, E>(mapError(error));
    }
  }

  static combine<T, E extends AppError>(
    results: ReadonlyArray<Result<T, E>>,
  ): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
      const state = result.state;
      if (state.status === 'err') return Result.err<T[], E>(state.error);
      values.push(state.value);
    }

    return Result.ok<T[], E>(values);
  }

  isOk(): this is Result<T, never> {
    return this.state.status === 'ok';
  }

  isErr(): this is Result<never, E> {
    return this.state.status === 'err';
  }

  get value(): T {
    const state = this.state;
    if (state.status === 'err') {
      throw new Error('Cannot read value from an error Result');
    }

    return state.value;
  }

  get error(): E {
    const state = this.state;
    if (state.status === 'ok') {
      throw new Error('Cannot read error from a successful Result');
    }

    return state.error;
  }

  map<U>(mapper: (value: T) => U): Result<U, E> {
    const state = this.state;
    if (state.status === 'ok') return Result.ok<U, E>(mapper(state.value));
    return Result.err<U, E>(state.error);
  }

  mapError<F extends AppError>(mapper: (error: E) => F): Result<T, F> {
    const state = this.state;
    if (state.status === 'ok') return Result.ok<T, F>(state.value);
    return Result.err<T, F>(mapper(state.error));
  }

  match<R>(matcher: {
    readonly ok: (value: T) => R;
    readonly err: (error: E) => R;
  }): R {
    const state = this.state;
    if (state.status === 'ok') return matcher.ok(state.value);
    return matcher.err(state.error);
  }

  unwrapOr(fallback: T): T {
    const state = this.state;
    if (state.status === 'ok') return state.value;
    return fallback;
  }
}
