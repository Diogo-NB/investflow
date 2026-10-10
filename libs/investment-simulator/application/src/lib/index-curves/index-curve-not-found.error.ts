import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class IndexCurveNotFoundError extends NotFoundError {
  constructor(curveId: string) {
    super('Esta curva foi excluída. Escolha outra curva.', {
      code: EAppErrorCode.INDEX_CURVE_NOT_FOUND,
      metadata: { curveId },
    });
  }
}
