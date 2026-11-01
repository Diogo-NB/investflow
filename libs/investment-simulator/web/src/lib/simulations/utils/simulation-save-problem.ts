import { ApiError } from '../../http/api-error';
import type { SimulationField } from './simulation-form';

export interface SaveProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: SimulationField | null;
  // The simulation or its own terms changed elsewhere; reloading shows the
  // saved version.
  readonly conflict: boolean;
}

// The API explains the failure; the form only needs to know where to point.
const FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_CURVE_REQUIRED: 'curveId',
  INVESTMENT_CURVE_INCOMPATIBLE: 'curveId',
  INVESTMENT_CURVE_UNAVAILABLE: 'curveId',
  CURVE_NOT_FOUND: 'curveId',
  OFFER_NOT_FOUND: 'offerId',
  INVESTMENT_PRINCIPAL_INVALID: 'principal',
};

const CONFLICT_CODES: ReadonlySet<string> = new Set([
  'SIMULATION_REVISION_CONFLICT',
  'OFFER_REVISION_CONFLICT',
]);

// Failures caused by the terms, which the form always shows as fields.
const TERM_FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_PERIOD_INVALID: 'maturityDate',
  INVESTMENT_TERM_TOO_SHORT: 'maturityDate',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'remunerationKind',
  INVALID_RATE: 'rate',
};

function problemField(error: ApiError): SimulationField | null {
  if (error.code === 'INVESTMENT_DATE_NOT_BUSINESS_DAY') {
    return error.details['field'] === 'maturityDate'
      ? 'maturityDate'
      : 'investmentDate';
  }
  if (!error.code) return null;
  return TERM_FIELD_BY_CODE[error.code] ?? FIELD_BY_CODE[error.code] ?? null;
}

export function describeSaveProblem(error: unknown): SaveProblem {
  if (!(error instanceof ApiError)) {
    return {
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      field: null,
      conflict: false,
    };
  }
  return {
    message:
      error.userMessage ?? 'Não foi possível concluir agora. Tente novamente.',
    field: problemField(error),
    conflict: CONFLICT_CODES.has(error.code ?? ''),
  };
}
