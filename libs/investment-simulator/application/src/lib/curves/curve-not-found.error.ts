import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class CurveNotFoundError extends NotFoundError {
  constructor(curveId: string) {
    super('Esta curva não está mais disponível.', {
      code: EAppErrorCode.CURVE_NOT_FOUND,
      metadata: { curveId },
    });
  }
}
