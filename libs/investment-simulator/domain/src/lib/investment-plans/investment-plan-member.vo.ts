import {
  CalendarDate,
  InputFingerprint,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import { ESimulationCalculationStatus } from '../simulations/simulation-calculation.vo';
import { SimulationResultValidity } from '../simulations/simulation-result-validity.vo';

// What a member's last successful result returns at maturity, and what it
// was calculated from.
export interface InvestmentPlanMemberResult {
  readonly inputFingerprint: InputFingerprint;
  readonly principal: Money;
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly netFinalBalance: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
}

export interface InvestmentPlanMemberProps {
  readonly calculationStatus: ESimulationCalculationStatus;
  // Of the premises the simulation is at now; its result is current only
  // when it was calculated from them.
  readonly currentInputFingerprint: InputFingerprint;
  // The offer's current terms: results don't record liquidity.
  readonly redemptionTerms: RedemptionTerms;
  readonly lastResult: InvestmentPlanMemberResult | null;
}

// A live simulation of a plan, as the plan sees it.
export class InvestmentPlanMember extends ValueObject<InvestmentPlanMember> {
  private constructor(private readonly props: InvestmentPlanMemberProps) {
    super();
  }

  static create(props: InvestmentPlanMemberProps): InvestmentPlanMember {
    return new InvestmentPlanMember({ ...props });
  }

  get calculationStatus(): ESimulationCalculationStatus {
    return this.props.calculationStatus;
  }

  get redemptionTerms(): RedemptionTerms {
    return this.props.redemptionTerms;
  }

  // Kept while a recalculation runs or after it fails, current or not.
  get lastResult(): InvestmentPlanMemberResult | null {
    return this.props.lastResult;
  }

  get validity(): SimulationResultValidity {
    return SimulationResultValidity.create({
      calculationStatus: this.props.calculationStatus,
      currentInputFingerprint: this.props.currentInputFingerprint,
      resultInputFingerprint: this.props.lastResult?.inputFingerprint ?? null,
    });
  }

  get isResultCurrent(): boolean {
    return this.validity.isResultCurrent;
  }

  equals(other: InvestmentPlanMember): boolean {
    return (
      this.props.calculationStatus === other.props.calculationStatus &&
      this.props.currentInputFingerprint.equals(
        other.props.currentInputFingerprint,
      ) &&
      this.props.redemptionTerms.equals(other.props.redemptionTerms) &&
      sameResult(this.props.lastResult, other.props.lastResult)
    );
  }
}

function sameResult(
  a: InvestmentPlanMemberResult | null,
  b: InvestmentPlanMemberResult | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.inputFingerprint.equals(b.inputFingerprint) &&
    a.principal.equals(b.principal) &&
    a.iof.equals(b.iof) &&
    a.incomeTax.equals(b.incomeTax) &&
    a.netFinalBalance.equals(b.netFinalBalance) &&
    a.investmentDate.equals(b.investmentDate) &&
    a.maturityDate.equals(b.maturityDate)
  );
}
