import {
  Curve,
  EEconomicIndex,
  ETitleType,
  Offer,
  RemunerationKind,
} from '@investflow/investment-simulator-domain';
import { DomainEvent, UtcInstant } from '@investflow/shared-domain';
import { EExperimentEventContent } from '@investflow/shared-infrastructure';

// The variants that carry content; V1 keeps the domain's events.
export type ContentCarryingEventContent =
  | EExperimentEventContent.DELTA
  | EExperimentEventContent.STATE;

// What a calculation reads of an offer, on the wire. V3 sends every field;
// V2 sends only the ones that changed, all of them on creation.
export interface OfferCopyFields {
  readonly titleType?: ETitleType;
  readonly maturityDate?: string;
  readonly redemptionKind?: 'AT_MATURITY' | 'DAILY';
  readonly remuneration?: {
    readonly kind: RemunerationKind;
    readonly rate: string;
  };
  readonly isDeleted?: boolean;
}

export interface CurveCopyInterval {
  readonly startDate: string;
  readonly endDate: string;
  readonly value: string;
}

// As OfferCopyFields; the intervals are one field.
export interface CurveCopyFields {
  readonly index?: EEconomicIndex;
  readonly intervals?: readonly CurveCopyInterval[];
  readonly isDeleted?: boolean;
}

export type CompleteOfferCopyFields = Required<OfferCopyFields>;
export type CompleteCurveCopyFields = Required<CurveCopyFields>;

export function offerCopyFieldsOf(offer: Offer): CompleteOfferCopyFields {
  return {
    titleType: offer.titleType,
    maturityDate: offer.maturityDate.toIsoString(),
    redemptionKind: offer.redemptionTerms.kind,
    remuneration: {
      kind: offer.remunerationTerms.kind,
      rate: offer.remunerationTerms.contractRate.value.toString(),
    },
    isDeleted: offer.deletedAt !== null,
  };
}

export function curveCopyFieldsOf(curve: Curve): CompleteCurveCopyFields {
  return {
    index: curve.index,
    intervals: curve.intervals.map((interval) => ({
      startDate: interval.range.start.toIsoString(),
      endDate: interval.range.end.toIsoString(),
      value: interval.value.value.toString(),
    })),
    isDeleted: curve.deletedAt !== null,
  };
}

// The payload version says which variant wrote it.
const payloadVersionOf: Readonly<Record<ContentCarryingEventContent, number>> =
  {
    [EExperimentEventContent.DELTA]: 2,
    [EExperimentEventContent.STATE]: 3,
  };

// Replaces an identifier-only offer event, keeping its type, id, and time, so
// routing, deduplication, and the fault selectors see the same event.
export class OfferContentEvent implements DomainEvent {
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly eventType: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateType = 'Offer';
  readonly context = 'investment-simulator';

  constructor(
    source: DomainEvent,
    content: ContentCarryingEventContent,
    readonly revision: number,
    readonly termsRevision: number,
    readonly offer: OfferCopyFields,
  ) {
    this.eventId = source.eventId;
    this.occurredAt = source.occurredAt;
    this.eventType = source.eventType;
    this.aggregateId = source.aggregateId;
    this.version = payloadVersionOf[content];
  }
}

export class CurveContentEvent implements DomainEvent {
  readonly eventId: string;
  readonly occurredAt: UtcInstant;
  readonly eventType: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateType = 'Curve';
  readonly context = 'investment-simulator';

  constructor(
    source: DomainEvent,
    content: ContentCarryingEventContent,
    readonly revision: number,
    readonly valuesRevision: number,
    readonly curve: CurveCopyFields,
  ) {
    this.eventId = source.eventId;
    this.occurredAt = source.occurredAt;
    this.eventType = source.eventType;
    this.aggregateId = source.aggregateId;
    this.version = payloadVersionOf[content];
  }
}
