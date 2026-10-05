import {
  AppErrorMetadata,
  CalendarDate,
  DomainError,
} from '@investflow/shared-domain';

export class InvalidIndexCurveError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(`Invalid index curve: ${reason}`, {
      code: 'INVALID_INDEX_CURVE',
      metadata: { ...metadata, reason },
    });
  }
}

export class IndexCurveValueNotFoundError extends DomainError {
  constructor(curveId: string, reference: CalendarDate) {
    super('Index curve does not cover the requested reference', {
      code: 'INDEX_CURVE_VALUE_NOT_FOUND',
      metadata: { curveId, reference: reference.toIsoString() },
    });
  }
}
