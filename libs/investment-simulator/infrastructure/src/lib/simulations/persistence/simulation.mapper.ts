import {
  ETitleType,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import {
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  InvestmentTitleType,
  Simulation as SimulationRecord,
} from '@prisma/client';

export interface SimulationPersistenceData {
  readonly id: string;
  readonly ownerId: string;
  readonly sourceOfferId: string | null;
  readonly titleType: InvestmentTitleType;
  readonly issuerId: string | null;
  readonly maturityDate: Date;
  readonly redemptionType: InvestmentRedemptionType;
  readonly remunerationType: InvestmentRemunerationType;
  readonly rateValue: string;
  readonly deletedAt: Date | null;
}

export class SimulationMapper {
  static toDomain(record: SimulationRecord): Simulation {
    return Simulation.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      sourceOfferId: record.sourceOfferId,
      terms: InvestmentTerms.create({
        titleType: record.titleType as ETitleType,
        issuerId: record.issuerId,
        maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
        redemption: RedemptionTerms.create(record.redemptionType),
        remuneration: RemunerationTerms.create(
          record.remunerationType,
          Rate.of(record.rateValue.toFixed()),
        ),
      }),
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(simulation: Simulation): SimulationPersistenceData {
    const { terms } = simulation;
    return {
      id: simulation.id,
      ownerId: simulation.ownerId,
      sourceOfferId: simulation.sourceOfferId,
      titleType: terms.titleType,
      issuerId: terms.issuerId,
      maturityDate: terms.maturityDate.toUtcDate(),
      redemptionType: terms.redemption.kind,
      remunerationType: terms.remuneration.kind,
      rateValue: terms.remuneration.contractRate.value.toFixed(),
      deletedAt: simulation.deletedAt?.date ?? null,
    };
  }
}
