import {
  AppErrorMetadata,
  ConflictError,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class InvalidOfferError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(reason, { code: EAppErrorCode.INVALID_OFFER, metadata });
  }
}

export class OfferRevisionConflictError extends ConflictError {
  constructor(id: string, expectedRevision: number) {
    super(
      'Estes dados foram alterados em outro lugar. Recarregue e tente novamente.',
      {
        code: EAppErrorCode.OFFER_REVISION_CONFLICT,
        metadata: { id, expectedRevision },
      },
    );
  }
}

export class OfferReadOnlyError extends DomainError {
  constructor(id: string) {
    super(
      'Ofertas do sistema não podem ser alteradas. Duplique a oferta para editá-la.',
      {
        code: EAppErrorCode.OFFER_READ_ONLY,
        kind: 'forbidden',
        metadata: { id },
      },
    );
  }
}
