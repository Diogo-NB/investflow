// Domain builders shared by the application use-case specs.
import {
  Application,
  EconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  TitleType,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  Money,
  Rate,
} from '@investflow/shared-domain';

export const OWNER_ID = 'owner-id';

export function catalogOffer(kind: 'PREFIXED' | 'CDI_PERCENTAGE' = 'PREFIXED') {
  return Offer.create({
    titleType: TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: CalendarDate.of('2030-01-02'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create(kind, Rate.of('1.05')),
  });
}

export function cdiCurve() {
  return IndexCurve.create({
    name: 'Base',
    index: EconomicIndex.CDI,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-01-01'),
          CalendarDate.of('2030-01-01'),
        ),
        IndexValue.of('0.12'),
      ),
    ],
  }).value;
}

export function ownedApplication(
  snapshot = catalogOffer().createSnapshot().value,
) {
  const application = Application.create({
    ownerId: OWNER_ID,
    offerSnapshot: snapshot,
    indexCurve: null,
    principal: Money.of('1000'),
    investmentDate: CalendarDate.of('2026-01-02'),
  }).value;
  return { application, snapshot };
}
