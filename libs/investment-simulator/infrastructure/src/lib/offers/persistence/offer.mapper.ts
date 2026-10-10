import {
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  TitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import {
  InvestmentOffer,
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  InvestmentTitleType,
} from '@prisma/client';

export interface OfferPersistenceData {
  readonly id: string;
  readonly titleType: InvestmentTitleType;
  readonly issuerId: string;
  readonly maturityDate: Date;
  readonly redemptionType: InvestmentRedemptionType;
  readonly remunerationType: InvestmentRemunerationType;
  readonly rateValue: string;
  readonly deletedAt: Date | null;
}

export class OfferMapper {
  static toDomain(record: InvestmentOffer): Offer {
    return Offer.reconstitute({
      id: record.id,
      titleType: record.titleType as TitleType,
      issuerId: record.issuerId,
      maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
      redemptionTerms: RedemptionTerms.create(record.redemptionType),
      remunerationTerms: RemunerationTerms.create(
        record.remunerationType,
        Rate.of(record.rateValue.toString()),
      ),
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(offer: Offer): OfferPersistenceData {
    return {
      id: offer.id,
      titleType: offer.titleType,
      issuerId: offer.issuerId,
      maturityDate: offer.maturityDate.toUtcDate(),
      redemptionType: offer.redemptionTerms.kind,
      remunerationType: offer.remunerationTerms.kind,
      rateValue: offer.remunerationTerms.contractRate.value.toString(),
      deletedAt: offer.deletedAt?.date ?? null,
    };
  }
}
