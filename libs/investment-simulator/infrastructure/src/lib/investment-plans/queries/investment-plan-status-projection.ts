import {
  InvestmentPlan,
  InvestmentPlanStatus,
} from '@investflow/investment-simulator-domain';
import { Prisma } from '@prisma/client';

// Shared by the list and detail queries: both report the same status.
export interface InvestmentPlanStatusOutput {
  // Members waiting for a calculation.
  readonly calculatingCount: number;
  // Members whose last calculation was invalid or failed.
  readonly pendingIssueCount: number;
  // Members with a stale result and no calculation waiting.
  readonly outdatedResultCount: number;
  readonly isSettled: boolean;
}

// Members whose simulation was deleted have left the plan.
export const liveMemberCount = {
  _count: {
    select: { simulations: { where: { simulation: { deletedAt: null } } } },
  },
} satisfies Prisma.InvestmentPlanSelect;

// Zero when the plan is full.
export function toAvailableSimulationSlots(memberCount: number): number {
  return Math.max(0, InvestmentPlan.SIMULATION_LIMIT - memberCount);
}

export function toInvestmentPlanStatusOutput(
  status: InvestmentPlanStatus,
): InvestmentPlanStatusOutput {
  return {
    calculatingCount: status.calculatingCount,
    pendingIssueCount: status.pendingIssueCount,
    outdatedResultCount: status.outdatedResultCount,
    isSettled: status.isSettled,
  };
}
