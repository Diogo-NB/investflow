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

export interface InvestmentPlanMaturityMonth {
  // YYYY-MM.
  readonly month: string;
  readonly simulationCount: number;
  // Those whose maturity date is on or before today.
  readonly maturedSimulationCount: number;
  readonly netFinalBalance: string;
  readonly accumulatedNetFinalBalance: string;
}

// Shares are decimal fractions that add up to 1.
export interface InvestmentPlanLiquidity {
  readonly dailyPrincipal: string;
  readonly atMaturityPrincipal: string;
  readonly dailyShare: string;
  readonly atMaturityShare: string;
}

// Each member's last successful result at its own maturity; members without
// one are left out and counted.
export interface InvestmentPlanTotals {
  readonly excludedSimulationCount: number;
  // While some member is calculating, has a pending issue, or a stale result.
  readonly isProvisional: boolean;
  readonly principal: string;
  readonly iof: string;
  readonly incomeTax: string;
  readonly netFinalBalance: string;
  readonly netEarnings: string;
  readonly period: { readonly start: string; readonly end: string };
  readonly maturityMonths: readonly InvestmentPlanMaturityMonth[];
  readonly liquidity: InvestmentPlanLiquidity;
}

export interface InvestmentPlanDetail extends InvestmentPlanListItem {
  readonly revision: number;
  // Null when no member has a result.
  readonly totals: InvestmentPlanTotals | null;
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
