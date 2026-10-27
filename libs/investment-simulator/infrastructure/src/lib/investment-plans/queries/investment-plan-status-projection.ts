import {
  ESimulationCalculationStatus,
  ETitleType,
  InvestmentPlanStatus,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import { Prisma } from '@prisma/client';

// Shared by the list and detail queries: both report the same status from
// the same member rows.
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
export const liveInvestmentPlanMembers = {
  where: { simulation: { deletedAt: null } },
  select: {
    simulation: {
      select: {
        revision: true,
        offer: { select: { titleType: true, termsRevision: true } },
        curve: { select: { valuesRevision: true } },
        calculation: { select: { status: true } },
        result: {
          select: {
            simulationRevision: true,
            offerTermsRevision: true,
            curveValuesRevision: true,
            methodologyVersion: true,
          },
        },
      },
    },
  },
} satisfies Prisma.InvestmentPlan$simulationsArgs;

type InvestmentPlanMemberRecord = Prisma.InvestmentPlanSimulationGetPayload<{
  select: (typeof liveInvestmentPlanMembers)['select'];
}>;

export function toInvestmentPlanStatus(
  members: readonly InvestmentPlanMemberRecord[],
): InvestmentPlanStatusOutput {
  const status = InvestmentPlanStatus.of(
    members.map(({ simulation }) => {
      const { offer, result, calculation } = simulation;
      if (!calculation) {
        throw new Error('A plan member without a calculation row');
      }
      return {
        calculationStatus: calculation.status as ESimulationCalculationStatus,
        isResultCurrent:
          result !== null &&
          SimulationResult.isCurrent(
            result,
            SimulationResult.targetFor(
              simulation.revision,
              offer.titleType as ETitleType,
              offer.termsRevision,
              simulation.curve?.valuesRevision ?? null,
            ),
          ),
      };
    }),
  );
  return {
    calculatingCount: status.calculatingCount,
    pendingIssueCount: status.pendingIssueCount,
    outdatedResultCount: status.outdatedResultCount,
    isSettled: status.isSettled,
  };
}
