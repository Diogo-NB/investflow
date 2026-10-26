import {
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import { Offer as OfferRecord, Prisma } from '@prisma/client';

export class OfferMapper {
  static toDomain(record: OfferRecord): Offer {
    return Offer.reconstitute({
      id: record.id,
      titleType: record.titleType as ETitleType,
      ownerId: record.ownerId,
      name: record.name,
      issuerName: record.issuerName,
      maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
      redemptionTerms: RedemptionTerms.create(record.redemptionType),
      remunerationTerms: RemunerationTerms.create(
        record.remunerationType,
        Rate.of(record.rateValue.toString()),
      ),
      revision: record.revision,
      termsRevision: record.termsRevision,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(offer: Offer): Prisma.OfferUncheckedCreateInput {
    return {
      id: offer.id,
      ownerId: offer.ownerId,
      titleType: offer.titleType,
      name: offer.name,
      issuerName: offer.issuerName,
      maturityDate: offer.maturityDate.toUtcDate(),
      redemptionType: offer.redemptionTerms.kind,
      remunerationType: offer.remunerationTerms.kind,
      rateValue: offer.remunerationTerms.contractRate.value.toString(),
      revision: offer.revision,
      termsRevision: offer.termsRevision,
      deletedAt: offer.deletedAt?.date ?? null,
    };
  }
}
