import { NotFoundError } from '@investflow/shared-domain';

export class IssuerNotFoundError extends NotFoundError {
  constructor(issuerId: string) {
    super(`Issuer ${issuerId} was not found`, {
      code: 'ISSUER_NOT_FOUND',
      metadata: { issuerId },
    });
  }
}
