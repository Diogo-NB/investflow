import { formatPercentOf } from '../../decimals/format-decimal';
import type { EconomicIndex } from '../../offers/models/offer-terms';

export const INDEXES: readonly EconomicIndex[] = ['CDI', 'SELIC', 'IPCA'];

export const INDEX_LABELS: Record<EconomicIndex, string> = {
  CDI: 'CDI',
  SELIC: 'SELIC efetiva',
  IPCA: 'IPCA',
};

export const CONVENTION_LABELS: Record<EconomicIndex, string> = {
  CDI: 'Taxa anual efetiva, base 252',
  SELIC: 'Taxa anual efetiva, base 252',
  IPCA: 'Variação mensal',
};

export const VALUE_UNITS: Record<EconomicIndex, string> = {
  CDI: '% a.a.',
  SELIC: '% a.a.',
  IPCA: '% no mês',
};

// IPCA intervals cover whole months, typed as MM/AAAA.
export function isMonthly(index: EconomicIndex): boolean {
  return index === 'IPCA';
}

export function formatCurveValue(index: EconomicIndex, fraction: string) {
  const negative = fraction.startsWith('-');
  const percent = formatPercentOf(negative ? fraction.slice(1) : fraction);
  return `${negative ? '−' : ''}${percent}${VALUE_UNITS[index]}`;
}
