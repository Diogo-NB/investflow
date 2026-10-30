import { formatIsoDate } from '../../dates/calendar-date';
import type { SelectGroup, SelectOption } from '../../ui/select-field';
import {
  issuerAndNameLabel,
  offerTermsLabel,
  UNSUPPORTED_LABELS,
  type UnsupportedReason,
} from '../models/offer-terms';
import type { ContentOrigin, OfferSummary } from '../models/offer.types';

export const ORIGIN_LABELS: Record<ContentOrigin, string> = {
  SYSTEM: 'Do sistema',
  OWN: 'Minhas',
};

type SelectableOffer = OfferSummary & {
  readonly unsupportedReason?: UnsupportedReason | null;
};

function offerOption(offer: SelectableOffer): SelectOption {
  return {
    value: offer.id,
    label: offerTermsLabel(offer),
    detail: offer.unsupportedReason
      ? UNSUPPORTED_LABELS[offer.unsupportedReason]
      : `${issuerAndNameLabel(offer)} · vence em ${formatIsoDate(offer.maturityDate)}`,
    disabled: Boolean(offer.unsupportedReason),
  };
}

// Offers arrive ordered by title type and origin, so groups keep that order.
export function offerSelectGroups(
  offers: readonly SelectableOffer[],
): SelectGroup[] {
  const groups = new Map<string, SelectOption[]>();
  for (const offer of offers) {
    const label = `${offer.titleType} · ${ORIGIN_LABELS[offer.origin]}`;
    groups.set(label, [...(groups.get(label) ?? []), offerOption(offer)]);
  }
  return [...groups].map(([label, options]) => ({ label, options }));
}
