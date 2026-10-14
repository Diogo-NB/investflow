import {
  AppErrorMetadata,
  CalendarDate,
  ConflictError,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class InvalidCurveError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(reason, { code: EAppErrorCode.INVALID_CURVE, metadata });
  }
}

// A day the curve needs between its first and last dates has no value.
export class CurveIntervalGapError extends DomainError {
  constructor(start: CalendarDate, end: CalendarDate) {
    super(
      start.equals(end)
        ? `Falta o valor de ${start.toPtBrString()}.`
        : `Faltam valores de ${start.toPtBrString()} a ${end.toPtBrString()}.`,
      {
        code: EAppErrorCode.CURVE_INTERVAL_GAP,
        metadata: { start: start.toIsoString(), end: end.toIsoString() },
      },
    );
  }
}

export class CurveRevisionConflictError extends ConflictError {
  constructor(id: string, expectedRevision: number) {
    super(
      'Estes dados foram alterados em outro lugar. Recarregue e tente novamente.',
      {
        code: EAppErrorCode.CURVE_REVISION_CONFLICT,
        metadata: { id, expectedRevision },
      },
    );
  }
}

export class CurveReadOnlyError extends DomainError {
  constructor(id: string) {
    super(
      'Curvas do sistema não podem ser alteradas. Duplique a curva para editá-la.',
      {
        code: EAppErrorCode.CURVE_READ_ONLY,
        kind: 'forbidden',
        metadata: { id },
      },
    );
  }
}

export class CurveValueNotFoundError extends DomainError {
  constructor(curveId: string, reference: CalendarDate) {
    super('A curva não tem valor para a data solicitada.', {
      code: EAppErrorCode.CURVE_VALUE_NOT_FOUND,
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

export class CurveCoverageError extends DomainError {
  constructor(curveId: string, missing: readonly MissingCoverageRange[]) {
    super(coverageMessage(missing), {
      code: EAppErrorCode.CURVE_COVERAGE_MISSING,
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
