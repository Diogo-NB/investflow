import {
  DomainError,
  EAppErrorCode,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ComparedResult, ComparedSimulation } from './compared-simulation.vo';

export interface ComparisonStanding {
  // Ties share a position, and the next one skips: 1, 1, 3.
  readonly position: number;
  readonly isLeader: boolean;
  // The leader's net annual return minus this one's.
  readonly netAnnualReturnGap: Decimal;
  // The leader's net final balance minus this one's, only when the amounts
  // are comparable.
  readonly netBalanceGap: Money | null;
}

// Simulations compared side by side, ranked by the net annual return of their
// last successful result: the only measure fair across different terms and
// across taxed and exempt titles. Stale results rank like current ones;
// `isSettled` says whether any did.
export class SimulationComparison extends ValueObject<SimulationComparison> {
  static readonly MIN_SIMULATIONS = 2;
  static readonly MAX_SIMULATIONS = 6;

  // At least two results with the same principal and term: the amounts then
  // rank like the annual returns, so the leader also ends with the most money.
  readonly areAmountsComparable: boolean;
  readonly isSettled: boolean;
  private readonly standings: ReadonlyMap<string, ComparisonStanding>;

  private constructor(readonly simulations: readonly ComparedSimulation[]) {
    super();
    const ranked = simulations.flatMap(({ id, lastResult }) =>
      lastResult ? [{ id, result: lastResult }] : [],
    );
    this.areAmountsComparable =
      ranked.length > 1 &&
      ranked.every(({ result }) => sameInvestment(result, ranked[0].result));
    this.isSettled = simulations.every(({ isSettled }) => isSettled);
    this.standings = this.rank(ranked);
  }

  static of(simulations: readonly ComparedSimulation[]): SimulationComparison {
    const ids = new Set(simulations.map(({ id }) => id));
    if (
      simulations.length < SimulationComparison.MIN_SIMULATIONS ||
      simulations.length > SimulationComparison.MAX_SIMULATIONS ||
      ids.size !== simulations.length
    ) {
      throw new DomainError('Compare de 2 a 6 simulações diferentes.', {
        code: EAppErrorCode.SIMULATION_COMPARISON_INVALID,
        kind: 'unexpected',
        metadata: { simulations: simulations.length, distinct: ids.size },
      });
    }
    return new SimulationComparison([...simulations]);
  }

  // Null for a simulation without a result, which is left unranked.
  standingOf(id: string): ComparisonStanding | null {
    return this.standings.get(id) ?? null;
  }

  private rank(
    ranked: readonly { id: string; result: ComparedResult }[],
  ): ReadonlyMap<string, ComparisonStanding> {
    const ordered = [...ranked].sort((a, b) =>
      b.result.netAnnualReturn.comparedTo(a.result.netAnnualReturn),
    );
    const standings = new Map<string, ComparisonStanding>();
    if (ordered.length === 0) return standings;
    const leader = ordered[0].result;
    let position = 0;
    ordered.forEach(({ id, result }, index) => {
      const previous = ordered[index - 1]?.result;
      if (!previous?.netAnnualReturn.equals(result.netAnnualReturn)) {
        position = index + 1;
      }
      standings.set(id, {
        position,
        isLeader: position === 1,
        netAnnualReturnGap: leader.netAnnualReturn.minus(
          result.netAnnualReturn,
        ),
        netBalanceGap: this.areAmountsComparable
          ? leader.netFinalBalance.subtract(result.netFinalBalance)
          : null,
      });
    });
    return standings;
  }

  equals(other: SimulationComparison): boolean {
    return (
      this.simulations.length === other.simulations.length &&
      this.simulations.every((simulation, index) =>
        simulation.equals(other.simulations[index]),
      )
    );
  }
}

function sameInvestment(a: ComparedResult, b: ComparedResult): boolean {
  return (
    a.principal.equals(b.principal) &&
    a.investmentDate.equals(b.investmentDate) &&
    a.maturityDate.equals(b.maturityDate)
  );
}
