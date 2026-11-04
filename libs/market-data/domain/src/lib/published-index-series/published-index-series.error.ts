import {
  CalendarDate,
  ConflictError,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class PublishedIndexValueOutOfOrderError extends DomainError {
  constructor(seriesId: string, referenceDate: CalendarDate) {
    super(
      `O valor de ${referenceDate.toPtBrString()} não é posterior ao último valor da série.`,
      {
        code: EAppErrorCode.PUBLISHED_INDEX_VALUE_INVALID,
        metadata: { seriesId, referenceDate: referenceDate.toIsoString() },
      },
    );
  }
}

export class PublishedIndexValueOutsideYearError extends DomainError {
  constructor(seriesId: string, year: number, referenceDate: CalendarDate) {
    super(`O valor de ${referenceDate.toPtBrString()} não é de ${year}.`, {
      code: EAppErrorCode.PUBLISHED_INDEX_VALUE_INVALID,
      metadata: { seriesId, year, referenceDate: referenceDate.toIsoString() },
    });
  }
}

export class PublishedIndexSeriesRevisionConflictError extends ConflictError {
  constructor(id: string, expectedRevision: number) {
    super('A série foi alterada em outro lugar. Tente novamente.', {
      code: EAppErrorCode.PUBLISHED_INDEX_SERIES_REVISION_CONFLICT,
      metadata: { id, expectedRevision },
    });
  }
}
