import {
  AppErrorMetadata,
  CalendarDate,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class InvalidIndexCurveError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(reason, {
      code: EAppErrorCode.INVALID_INDEX_CURVE,
      metadata,
    });
  }
}

export class IndexCurveValueNotFoundError extends DomainError {
  constructor(curveId: string, reference: CalendarDate) {
    super('A curva não tem valor para a data solicitada.', {
      code: EAppErrorCode.INDEX_CURVE_VALUE_NOT_FOUND,
      metadata: { curveId, reference: reference.toIsoString() },
    });
  }
}

export interface MissingCoverageRange {
  readonly start: CalendarDate;
  // Inclusive; equal to start for a single reference.
  readonly end: CalendarDate;
}

function coverageMessage(missing: readonly MissingCoverageRange[]): string {
  const [first, ...others] = missing;
  if (!first) return 'A curva não cobre todo o período.';
  const gap = first.start.equals(first.end)
    ? `A curva não tem valor em ${first.start.toPtBrString()}`
    : `A curva não tem valores entre ${first.start.toPtBrString()} e ${first.end.toPtBrString()}`;
  const more = others.length
    ? ` e em mais ${others.length} ${others.length === 1 ? 'período' : 'períodos'}`
    : '';
  return `${gap}${more}.`;
}

export class IndexCurveCoverageError extends DomainError {
  constructor(curveId: string, missing: readonly MissingCoverageRange[]) {
    super(coverageMessage(missing), {
      code: EAppErrorCode.INDEX_CURVE_COVERAGE_MISSING,
      metadata: {
        curveId,
        missingRanges: missing.map(({ start, end }) => ({
          start: start.toIsoString(),
          end: end.toIsoString(),
        })),
      },
    });
  }
}
