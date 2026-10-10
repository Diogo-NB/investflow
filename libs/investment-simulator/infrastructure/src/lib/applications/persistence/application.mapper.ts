import { Application } from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, UtcInstant } from '@investflow/shared-domain';
import { InvestmentApplication } from '@prisma/client';

export interface ApplicationPersistenceData {
  readonly id: string;
  readonly ownerId: string;
  readonly offerSnapshotId: string;
  readonly indexCurveId: string | null;
  readonly principal: string;
  readonly investmentDate: Date;
  readonly deletedAt: Date | null;
}

export class ApplicationMapper {
  static toDomain(record: InvestmentApplication): Application {
    return Application.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      offerSnapshotId: record.offerSnapshotId,
      indexCurveId: record.indexCurveId,
      principal: Money.of(record.principal.toFixed()),
      investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(application: Application): ApplicationPersistenceData {
    return {
      id: application.id,
      ownerId: application.ownerId,
      offerSnapshotId: application.offerSnapshotId,
      indexCurveId: application.indexCurveId,
      principal: application.principal.amount.toFixed(),
      investmentDate: application.investmentDate.toUtcDate(),
      deletedAt: application.deletedAt?.date ?? null,
    };
  }
}
