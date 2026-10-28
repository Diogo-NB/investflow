import { CalendarDate, Money, ValueObject } from '@investflow/shared-domain';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import { ETitleType } from '../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../simulations/simulation-calculation.vo';
import {
  SimulationResult,
  SimulationResultInputs,
} from '../simulations/simulation-result.vo';

// What a member's last successful result returns at maturity, and the
// revisions and methodology it was calculated from.
export interface InvestmentPlanMemberResult {
  readonly inputs: SimulationResultInputs;
  readonly principal: Money;
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly netFinalBalance: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
}

export interface InvestmentPlanMemberProps {
  readonly calculationStatus: ESimulationCalculationStatus;
  // The premises the simulation is at now; its result is current only when
  // it was calculated from them.
  readonly simulationRevision: number;
  readonly titleType: ETitleType;
  readonly offerTermsRevision: number;
  readonly curveValuesRevision: number | null;
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

  // False without a result.
  get isResultCurrent(): boolean {
    const { lastResult } = this.props;
    return (
      lastResult !== null &&
      SimulationResult.isCurrent(
        lastResult.inputs,
        SimulationResult.targetFor(
          this.props.simulationRevision,
          this.props.titleType,
          this.props.offerTermsRevision,
          this.props.curveValuesRevision,
        ),
      )
    );
  }

  equals(other: InvestmentPlanMember): boolean {
    return (
      this.props.calculationStatus === other.props.calculationStatus &&
      this.props.simulationRevision === other.props.simulationRevision &&
      this.props.titleType === other.props.titleType &&
      this.props.offerTermsRevision === other.props.offerTermsRevision &&
      this.props.curveValuesRevision === other.props.curveValuesRevision &&
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
    SimulationResult.isCurrent(a.inputs, b.inputs) &&
    a.principal.equals(b.principal) &&
    a.iof.equals(b.iof) &&
    a.incomeTax.equals(b.incomeTax) &&
    a.netFinalBalance.equals(b.netFinalBalance) &&
    a.investmentDate.equals(b.investmentDate) &&
    a.maturityDate.equals(b.maturityDate)
  );
}
