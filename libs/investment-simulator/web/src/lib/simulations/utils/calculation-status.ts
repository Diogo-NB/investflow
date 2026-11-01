import { formatIsoDate } from '../../dates/calendar-date';
import type {
  CalculationStatus,
  SimulationCalculation,
} from '../models/simulation.types';

// Null when the result is current and needs no tag.
export function calculationStatusLabel(
  status: CalculationStatus,
): string | null {
  switch (status) {
    case 'PENDING':
      return 'Calculando';
    case 'INVALID':
      return 'Requer ação';
    case 'FAILED':
      return 'Falha técnica';
    case 'CALCULATED':
      return null;
  }
}

export function describeCause({ cause }: SimulationCalculation): string {
  switch (cause.kind) {
    case 'CREATED':
      return 'simulação criada';
    case 'SIMULATION_EDITED':
      return 'simulação alterada';
    case 'RETRY_REQUESTED':
      return 'nova tentativa solicitada';
    case 'METHODOLOGY_CHANGED':
      return 'a metodologia de cálculo mudou';
    case 'PREMISES_CHANGED':
      return 'oferta ou curva alterada';
  }
}

interface MissingRange {
  readonly start: string;
  readonly end: string;
}

function isMissingRange(value: unknown): value is MissingRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['start'] === 'string' &&
    typeof (value as Record<string, unknown>)['end'] === 'string'
  );
}

// What the user must change for an INVALID calculation to succeed.
export function describeReason(
  reason: NonNullable<SimulationCalculation['reason']>,
): string {
  switch (reason.code) {
    case 'OFFER_NOT_FOUND':
      return 'Sem oferta, escolha outra.';
    case 'CURVE_NOT_FOUND':
    case 'INVESTMENT_CURVE_UNAVAILABLE':
      return 'Sem curva, escolha outra.';
    case 'INVESTMENT_CURVE_REQUIRED': {
      const index = reason.metadata['index'];
      return typeof index === 'string'
        ? `A oferta usa o ${index}. Escolha uma curva do ${index} e salve.`
        : 'Escolha a curva do índice e salve.';
    }
    case 'INVESTMENT_CURVE_INCOMPATIBLE': {
      const index = reason.metadata['expectedIndex'];
      return typeof index === 'string'
        ? `A curva não é do ${index}, o índice da oferta. Escolha uma curva do ${index} e salve.`
        : 'A oferta é prefixada e não usa curva. Salve novamente para removê-la.';
    }
    case 'INVESTMENT_CURVE_COVERAGE_MISSING': {
      const ranges = reason.metadata['missingRanges'];
      const missing = Array.isArray(ranges)
        ? ranges.filter(isMissingRange)
        : [];
      if (missing.length === 0) {
        return 'A curva não tem valores para todo o período. Escolha outra curva ou ajuste o período.';
      }
      const [first] = missing;
      const more = missing.length - 1;
      const rest =
        more === 0
          ? ''
          : ` e em mais ${more} ${more === 1 ? 'período' : 'períodos'}`;
      return `A curva não tem valores entre ${formatIsoDate(first.start)} e ${formatIsoDate(first.end)}${rest}. Escolha outra curva ou ajuste o período.`;
    }
    default:
      return 'Os dados da simulação não permitem o cálculo. Revise e salve novamente.';
  }
}
