import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Money,
  UtcInstant,
} from '@investflow/shared-domain';
import type { Application } from '../applications/application.aggregate';
import {
  DailyInvestmentBalance,
  InvestmentCalculation,
  InvestmentMaturitySummary,
} from '../calculations/investment-calculation.type';

interface SimulationRunProps {
  readonly ownerId: string;
  readonly applicationId: string;
  // The application's inputs at calculation time. Snapshots and curves are
  // immutable, so these references fully determine the scenario.
  readonly offerSnapshotId: string;
  readonly indexCurveId: string | null;
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly methodologyVersion: string;
  readonly calculatedAt: UtcInstant;
  readonly maturitySummary: InvestmentMaturitySummary;
  readonly dailyBalances: readonly DailyInvestmentBalance[];
}

export interface RecordSimulationRunProps {
  readonly application: Application;
  readonly calculation: InvestmentCalculation;
  readonly calculatedAt: UtcInstant;
}

export type ReconstituteSimulationRunProps = SimulationRunProps & {
  readonly id: string;
};

// An immutable record of one calculation of an application, kept so that
// results stay reproducible and auditable after the application changes.
export class SimulationRun extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationRunProps,
  ) {
    super(id);
  }

  static record({
    application,
    calculation,
    calculatedAt,
  }: RecordSimulationRunProps): SimulationRun {
    return new SimulationRun(generateUuid(), {
      ownerId: application.ownerId,
      applicationId: application.id,
      offerSnapshotId: application.offerSnapshotId,
      indexCurveId: application.indexCurveId,
      principal: application.principal,
      investmentDate: application.investmentDate,
      methodologyVersion: calculation.methodologyVersion,
      calculatedAt,
      maturitySummary: calculation.maturitySummary,
      dailyBalances: [...calculation.dailyBalances],
    });
  }

  static reconstitute(props: ReconstituteSimulationRunProps): SimulationRun {
    const { id, ...state } = props;
    return new SimulationRun(id, {
      ...state,
      dailyBalances: [...state.dailyBalances],
    });
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get applicationId(): string {
    return this.props.applicationId;
  }

  get offerSnapshotId(): string {
    return this.props.offerSnapshotId;
  }

  get indexCurveId(): string | null {
    return this.props.indexCurveId;
  }

  get principal(): Money {
    return this.props.principal;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get methodologyVersion(): string {
    return this.props.methodologyVersion;
  }

  get calculatedAt(): UtcInstant {
    return this.props.calculatedAt;
  }

  get maturitySummary(): InvestmentMaturitySummary {
    return this.props.maturitySummary;
  }

  get dailyBalances(): readonly DailyInvestmentBalance[] {
    return [...this.props.dailyBalances];
  }
}
