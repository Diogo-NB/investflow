import { ApiError } from '../../http/api-error';
import type { SimulationField, SimulationFormValues } from './simulation-form';

export interface SaveProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: SimulationField | null;
  // What changed elsewhere; reloading it shows the saved version.
  readonly conflict: 'simulation' | 'offer' | null;
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

const CONFLICT_BY_CODE: Readonly<
  Record<string, NonNullable<SaveProblem['conflict']>>
> = {
  SIMULATION_REVISION_CONFLICT: 'simulation',
  OFFER_REVISION_CONFLICT: 'offer',
};

// Failures caused by the offer's terms, which are fields only while typed.
const TERM_FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_PERIOD_INVALID: 'maturityDate',
  INVESTMENT_TERM_TOO_SHORT: 'maturityDate',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'remunerationKind',
  INVALID_RATE: 'rate',
};

function problemField(
  error: ApiError,
  offerMode: SimulationFormValues['offerMode'],
): SimulationField | null {
  // Terms are fields while edited or typed; otherwise the chosen offer is.
  const termField = (field: SimulationField) =>
    offerMode === 'existing' ? 'offerId' : field;
  if (error.code === 'INVESTMENT_DATE_NOT_BUSINESS_DAY') {
    return error.details['field'] === 'maturityDate'
      ? termField('maturityDate')
      : 'investmentDate';
  }
  if (!error.code) return null;
  const term = TERM_FIELD_BY_CODE[error.code];
  if (term) return termField(term);
  const field = FIELD_BY_CODE[error.code] ?? null;
  // The offer picker is hidden while its offer is edited.
  return field === 'offerId' && offerMode === 'editing' ? null : field;
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
      conflict: null,
    };
  }
  return {
    message:
      error.userMessage ?? 'Não foi possível concluir agora. Tente novamente.',
    field: problemField(error, offerMode),
    conflict: CONFLICT_BY_CODE[error.code ?? ''] ?? null,
  };
}
