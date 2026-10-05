import { NotFoundError } from '@investflow/shared-domain';

export class IndexCurveNotFoundError extends NotFoundError {
  constructor(curveId: string) {
    super(`Index curve ${curveId} was not found`, {
      code: 'INDEX_CURVE_NOT_FOUND',
      metadata: { curveId },
    });
  }
}
