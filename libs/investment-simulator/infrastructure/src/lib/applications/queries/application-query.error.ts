import { AppError } from '@investflow/shared-domain';

export class ApplicationQueryError extends AppError {
  constructor(cause: unknown) {
    super('Failed to read applications', {
      code: 'APPLICATION_QUERY_FAILED',
      kind: 'infrastructure',
      cause,
    });
  }
}
