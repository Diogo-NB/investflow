// Plan members and an in-memory member reader shared by the plan read
// use-case specs.
import {
  ESimulationCalculationStatus,
  ETitleType,
  InvestmentPlanMember,
  RedemptionTerms,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, Result } from '@investflow/shared-domain';
import { InvestmentPlanMemberReader } from '../investment-plan-member-reader.port';

export function planMember({
  calculationStatus = ESimulationCalculationStatus.CALCULATED,
  hasResult = true,
  principal = '1000',
  maturityDate = '2027-01-04',
}: {
  readonly calculationStatus?: ESimulationCalculationStatus;
  readonly hasResult?: boolean;
  readonly principal?: string;
  readonly maturityDate?: string;
} = {}): InvestmentPlanMember {
  return InvestmentPlanMember.create({
    calculationStatus,
    simulationRevision: 1,
    titleType: ETitleType.CDB,
    offerTermsRevision: 1,
    curveValuesRevision: null,
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    lastResult: hasResult
      ? {
          inputs: SimulationResult.targetFor(1, ETitleType.CDB, 1, null),
          principal: Money.of(principal),
          iof: Money.zero(),
          incomeTax: Money.of('20'),
          netFinalBalance: Money.of(principal).add(Money.of('80')),
          investmentDate: CalendarDate.of('2026-01-02'),
          maturityDate: CalendarDate.of(maturityDate),
        }
      : null,
  });
}

// Specs pass jest.fn, which the library build cannot reference.
type Spy = <F extends (...args: never[]) => unknown>(implementation: F) => F;

// Each plan's members by owner and plan id.
export function memberReader(
  spy: Spy,
  plans: Record<string, { ownerId: string; members: InvestmentPlanMember[] }>,
) {
  return {
    findByPlans: spy(async (ownerId: string, ids: readonly string[]) =>
      Result.ok(
        new Map(
          ids.flatMap((id) =>
            plans[id]?.ownerId === ownerId
              ? [[id, plans[id].members] as const]
              : [],
          ),
        ),
      ),
    ),
  } satisfies InvestmentPlanMemberReader;
}
