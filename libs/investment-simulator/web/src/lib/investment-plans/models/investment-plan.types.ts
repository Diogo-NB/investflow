// Counts of members by what keeps the plan's totals from being final.
export interface InvestmentPlanStatus {
  readonly calculatingCount: number;
  readonly pendingIssueCount: number;
  readonly outdatedResultCount: number;
  readonly isSettled: boolean;
}

export interface InvestmentPlanListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly simulationCount: number;
  // Zero when the plan is full.
  readonly availableSimulationSlots: number;
  readonly status: InvestmentPlanStatus;
}

export interface InvestmentPlanDetail extends InvestmentPlanListItem {
  readonly revision: number;
}

export interface InvestmentPlanInput {
  readonly name: string;
  readonly description: string | null;
}

// Only the fields that changed; null clears the description.
export interface InvestmentPlanEdit {
  readonly revision: number;
  readonly name?: string;
  readonly description?: string | null;
}
