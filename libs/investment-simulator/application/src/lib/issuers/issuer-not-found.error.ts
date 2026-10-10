import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class IssuerNotFoundError extends NotFoundError {
  constructor(issuerId: string) {
    super('Este emissor não está mais disponível.', {
      code: EAppErrorCode.ISSUER_NOT_FOUND,
      metadata: { issuerId },
    });
  }
}
