import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class PublishedIndexValuesQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar os índices publicados.', {
      code: EAppErrorCode.PUBLISHED_INDEX_VALUES_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
