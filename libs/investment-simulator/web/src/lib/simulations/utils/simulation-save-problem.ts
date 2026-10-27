import { ApiError } from '../../http/api-error';
import type { SimulationField, SimulationFormValues } from './simulation-form';

export interface SaveProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: SimulationField | null;
  // The simulation changed elsewhere; reloading shows the saved version.
  readonly conflict: boolean;
}

// The API explains the failure; the form only needs to know where to point.
const FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_CURVE_REQUIRED: 'curveId',
  INVESTMENT_CURVE_INCOMPATIBLE: 'curveId',
  INVESTMENT_CURVE_UNAVAILABLE: 'curveId',
  CURVE_NOT_FOUND: 'curveId',
  OFFER_NOT_FOUND: 'offerId',
  INVALID_OFFER: 'offerName',
  INVESTMENT_PRINCIPAL_INVALID: 'principal',
};

// Failures caused by the offer's terms, which are fields only while typed.
const TERM_FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_PERIOD_INVALID: 'maturityDate',
  INVESTMENT_TERM_TOO_SHORT: 'maturityDate',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'remunerationKind',
};

function problemField(
  error: ApiError,
  offerMode: SimulationFormValues['offerMode'],
): SimulationField | null {
  const termField = (field: SimulationField) =>
    offerMode === 'new' ? field : 'offerId';
  if (error.code === 'INVESTMENT_DATE_NOT_BUSINESS_DAY') {
    return error.details['field'] === 'maturityDate'
      ? termField('maturityDate')
      : 'investmentDate';
  }
  if (!error.code) return null;
  const term = TERM_FIELD_BY_CODE[error.code];
  return term ? termField(term) : (FIELD_BY_CODE[error.code] ?? null);
}

export function describeSaveProblem(
  error: unknown,
  offerMode: SimulationFormValues['offerMode'],
): SaveProblem {
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
    field: problemField(error, offerMode),
    conflict: error.code === 'SIMULATION_REVISION_CONFLICT',
  };
}
