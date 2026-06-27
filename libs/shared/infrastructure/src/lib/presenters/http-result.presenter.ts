import { AppError, Result } from '@investflow/shared-domain';

export class HttpResultPresenter {
  static unwrap<T, E extends AppError>(result: Result<T, E>): T {
    if (result.isOk()) return result.value;
    throw result.error;
  }
}
