import { CalendarDate, Money, ValueObject } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ETitleType } from '../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../simulations/simulation-calculation.vo';
import {
  SimulationResult,
  SimulationResultInputs,
} from '../simulations/simulation-result.vo';

// What a simulation's last successful result returns at maturity, as far as
// comparing it goes, and the revisions and methodology it was calculated from.
export interface ComparedResult {
  readonly inputs: SimulationResultInputs;
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly netFinalBalance: Money;
  readonly netAnnualReturn: Decimal;
}

export interface ComparedSimulationProps {
  readonly id: string;
  readonly calculationStatus: ESimulationCalculationStatus;
  // The premises the simulation is at now; its result is current only when
  // it was calculated from them.
  readonly simulationRevision: number;
  readonly titleType: ETitleType;
  readonly offerTermsRevision: number;
  readonly curveValuesRevision: number | null;
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

  // Its result is final: calculated from the current premises with nothing
  // queued. A retry can queue a calculation for a result that is current.
  get isSettled(): boolean {
    return (
      this.props.calculationStatus ===
        ESimulationCalculationStatus.CALCULATED && this.isResultCurrent
    );
  }

  equals(other: ComparedSimulation): boolean {
    return (
      this.props.id === other.props.id &&
      this.props.calculationStatus === other.props.calculationStatus &&
      this.props.simulationRevision === other.props.simulationRevision &&
      this.props.titleType === other.props.titleType &&
      this.props.offerTermsRevision === other.props.offerTermsRevision &&
      this.props.curveValuesRevision === other.props.curveValuesRevision &&
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
    SimulationResult.isCurrent(a.inputs, b.inputs) &&
    a.principal.equals(b.principal) &&
    a.investmentDate.equals(b.investmentDate) &&
    a.maturityDate.equals(b.maturityDate) &&
    a.netFinalBalance.equals(b.netFinalBalance) &&
    a.netAnnualReturn.equals(b.netAnnualReturn)
  );
}
