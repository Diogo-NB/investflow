import { AppError } from '../errors/app.error';
import { Result } from './result';

class TestError extends AppError {
  constructor(message = 'Test failure') {
    super(message, { code: 'TEST_FAILURE', kind: 'unexpected' });
  }
}

describe('Result', () => {
  it('wraps a successful value', () => {
    const result = Result.ok<number, TestError>(42);

    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.value).toBe(42);
  });

  it('wraps an error value', () => {
    const error = new TestError();
    const result = Result.err<number, TestError>(error);

    expect(result.isErr()).toBe(true);
    expect(result.isOk()).toBe(false);
    expect(result.error).toBe(error);
  });

  it('maps successful values', () => {
    const result = Result.ok<number, TestError>(2).map((value) => value * 3);

    expect(result.value).toBe(6);
  });

  it('maps errors without changing successful values', () => {
    const result = Result.err<number, TestError>(new TestError()).mapError(
      () => new TestError('Mapped failure'),
    );

    expect(result.error.message).toBe('Mapped failure');
  });

  it('chains successful values', () => {
    const result = Result.ok<number, TestError>(2).andThen((value) =>
      Result.ok<string, TestError>(String(value)),
    );

    expect(result.value).toBe('2');
  });

  it('matches both states', () => {
    const result = Result.ok<number, TestError>(2).match({
      ok: (value) => value * 2,
      err: () => 0,
    });

    expect(result).toBe(4);
  });

  it('returns fallback values for errors', () => {
    const result = Result.err<number, TestError>(new TestError()).unwrapOr(7);

    expect(result).toBe(7);
  });

  it('converts thrown errors', () => {
    const result = Result.fromThrowable(
      () => {
        throw new Error('Unexpected');
      },
      () => new TestError('Converted'),
    );

    expect(result.error.message).toBe('Converted');
  });

  it('converts rejected promises', async () => {
    const result = await Result.fromPromise(
      () => Promise.reject(new Error('Unexpected')),
      () => new TestError('Converted'),
    );

    expect(result.error.message).toBe('Converted');
  });

  it('combines successful results', () => {
    const result = Result.combine<number, TestError>([
      Result.ok<number, TestError>(1),
      Result.ok<number, TestError>(2),
    ]);

    expect(result.value).toEqual([1, 2]);
  });

  it('returns the first error when combining results', () => {
    const error = new TestError('First failure');
    const result = Result.combine<number, TestError>([
      Result.ok<number, TestError>(1),
      Result.err<number, TestError>(error),
      Result.err<number, TestError>(new TestError('Second failure')),
    ]);

    expect(result.error).toBe(error);
  });
});
