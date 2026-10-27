import { ValueObject } from '@investflow/shared-domain';
import { ESimulationCalculationStatus } from '../simulations/simulation-calculation.vo';

export interface InvestmentPlanMemberState {
  readonly calculationStatus: ESimulationCalculationStatus;
  // False when there is no result.
  readonly isResultCurrent: boolean;
}

// Derived from the members at read time, never stored. A stale result counts
// apart from a calculation in progress: a methodology change, exhausted
// retries, or a deleted offer can leave it stale with nothing queued.
export class InvestmentPlanStatus extends ValueObject<InvestmentPlanStatus> {
  private constructor(
    readonly calculatingCount: number,
    readonly pendingIssueCount: number,
    readonly outdatedResultCount: number,
  ) {
    super();
  }

  static of(
    members: readonly InvestmentPlanMemberState[],
  ): InvestmentPlanStatus {
    let calculating = 0;
    let pendingIssues = 0;
    let outdated = 0;
    for (const { calculationStatus, isResultCurrent } of members) {
      switch (calculationStatus) {
        case ESimulationCalculationStatus.PENDING:
          calculating += 1;
          break;
        case ESimulationCalculationStatus.INVALID:
        case ESimulationCalculationStatus.FAILED:
          pendingIssues += 1;
          break;
        case ESimulationCalculationStatus.CALCULATED:
          if (!isResultCurrent) outdated += 1;
          break;
      }
    }
    return new InvestmentPlanStatus(calculating, pendingIssues, outdated);
  }

  get isSettled(): boolean {
    return (
      this.calculatingCount === 0 &&
      this.pendingIssueCount === 0 &&
      this.outdatedResultCount === 0
    );
  }

  equals(other: InvestmentPlanStatus): boolean {
    return (
      this.calculatingCount === other.calculatingCount &&
      this.pendingIssueCount === other.pendingIssueCount &&
      this.outdatedResultCount === other.outdatedResultCount
    );
  }
}
