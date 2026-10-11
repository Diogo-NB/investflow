import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class CurveQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar as curvas.', {
      code: EAppErrorCode.CURVE_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
