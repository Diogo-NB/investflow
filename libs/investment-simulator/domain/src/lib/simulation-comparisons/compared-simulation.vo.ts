import {
  CalendarDate,
  InputFingerprint,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ESimulationCalculationStatus } from '../simulations/simulation-calculation.vo';
import { SimulationResultValidity } from '../simulations/simulation-result-validity.vo';

// What a simulation's last successful result returns at maturity, as far as
// comparing it goes, and what it was calculated from.
export interface ComparedResult {
  readonly inputFingerprint: InputFingerprint;
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly netFinalBalance: Money;
  readonly netAnnualReturn: Decimal;
}

export interface ComparedSimulationProps {
  readonly id: string;
  readonly calculationStatus: ESimulationCalculationStatus;
  // Of the premises the simulation is at now; its result is current only
  // when it was calculated from them.
  readonly currentInputFingerprint: InputFingerprint;
  readonly lastResult: ComparedResult | null;
}

// A live simulation of the owner, as a comparison sees it.
export class ComparedSimulation extends ValueObject<ComparedSimulation> {
  private constructor(private readonly props: ComparedSimulationProps) {
    super();
  }

  static create(props: ComparedSimulationProps): ComparedSimulation {
    return new ComparedSimulation({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get calculationStatus(): ESimulationCalculationStatus {
    return this.props.calculationStatus;
  }

  // Kept while a recalculation runs or after it fails, current or not.
  get lastResult(): ComparedResult | null {
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

  get isSettled(): boolean {
    return this.validity.isSettled;
  }

  equals(other: ComparedSimulation): boolean {
    return (
      this.props.id === other.props.id &&
      this.props.calculationStatus === other.props.calculationStatus &&
      this.props.currentInputFingerprint.equals(
        other.props.currentInputFingerprint,
      ) &&
      sameResult(this.props.lastResult, other.props.lastResult)
    );
  }
}

function sameResult(
  a: ComparedResult | null,
  b: ComparedResult | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.inputFingerprint.equals(b.inputFingerprint) &&
    a.principal.equals(b.principal) &&
    a.investmentDate.equals(b.investmentDate) &&
    a.maturityDate.equals(b.maturityDate) &&
    a.netFinalBalance.equals(b.netFinalBalance) &&
    a.netAnnualReturn.equals(b.netAnnualReturn)
  );
}
