import { AppError, Result } from '@investflow/shared-domain';
import { HttpResultPresenter } from './http-result.presenter';

class TestError extends AppError {
  constructor() {
    super('Failed', { code: 'FAILED', kind: 'validation' });
  }
}

describe('HttpResultPresenter', () => {
  it('returns the value for successful results', () => {
    const result = Result.ok<string, TestError>('ok');

    expect(HttpResultPresenter.unwrap(result)).toBe('ok');
  });

  it('throws the AppError for failed results', () => {
    const error = new TestError();
    const result = Result.err<string, TestError>(error);

    expect(() => HttpResultPresenter.unwrap(result)).toThrow(error);
  });
});
