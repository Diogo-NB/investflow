import { formatIsoDate } from '../../dates/calendar-date';
import { formatReturnPercent } from '../../decimals/format-decimal';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import { useLatestPublishedIndexValues } from './use-latest-published-index-values';

// A prefixed rate has no index of its own, and the CDI is its usual comparison.
const REFERENCE_INDEXES: Record<RemunerationKind, 'CDI' | 'SELIC' | null> = {
  PREFIXED: 'CDI',
  CDI_PERCENTAGE: 'CDI',
  SELIC_PERCENTAGE: 'SELIC',
  IPCA_PLUS: null,
};

/** The latest value to judge a rate by; null never holds a form back. */
export function useRateReferenceHint(kind: RemunerationKind): string | null {
  const { state } = useLatestPublishedIndexValues();
  if (state.status !== 'ready') return null;

  const index = REFERENCE_INDEXES[kind];
  const latest = state.values.find((value) => value.index === index);
  if (!index || !latest) return null;
  return `${index} em ${formatIsoDate(latest.referenceDate)}: ${formatReturnPercent(latest.value)} a.a.`;
}
