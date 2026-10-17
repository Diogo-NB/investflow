import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';

// A simulation's last successful result, as far as comparing it goes.
export interface ComparedResult {
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly netFinalBalance: Money;
  readonly netAnnualReturn: Decimal;
  // Calculated and matching the simulation's current inputs, revisions, and
  // methodology.
  readonly current: boolean;
}

export interface ComparedSimulation {
  readonly id: string;
  readonly result: ComparedResult | null;
}

export interface ComparisonStanding {
  // Ties share a position, and the next one skips: 1, 1, 3.
  readonly position: number;
  readonly leader: boolean;
  // The leader's net annual return minus this one's.
  readonly netAnnualReturnGap: Decimal;
  // The leader's net final balance minus this one's, only when the amounts
  // are comparable.
  readonly netBalanceGap: Money | null;
}

// Simulations compared side by side, ranked by net annual return: the only
// measure fair across different terms and across taxed and exempt titles.
// Stale results rank like current ones; `settled` says whether any did.
export class SimulationComparison extends ValueObject<SimulationComparison> {
  static readonly MIN_SIMULATIONS = 2;
  static readonly MAX_SIMULATIONS = 6;

  // At least two results with the same principal and term: the amounts then
  // rank like the annual returns, so the leader also ends with the most money.
  readonly amountsComparable: boolean;
  readonly settled: boolean;
  private readonly standings: ReadonlyMap<string, ComparisonStanding>;

  private constructor(readonly simulations: readonly ComparedSimulation[]) {
    super();
    const ranked = simulations.flatMap(({ id, result }) =>
      result ? [{ id, result }] : [],
    );
    this.amountsComparable =
      ranked.length > 1 &&
      ranked.every(({ result }) => sameInvestment(result, ranked[0].result));
    this.settled = simulations.every(({ result }) => result?.current === true);
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
        leader: position === 1,
        netAnnualReturnGap: leader.netAnnualReturn.minus(
          result.netAnnualReturn,
        ),
        netBalanceGap: this.amountsComparable
          ? leader.netFinalBalance.subtract(result.netFinalBalance)
          : null,
      });
    });
    return standings;
  }

  equals(other: SimulationComparison): boolean {
    return (
      this.simulations.length === other.simulations.length &&
      this.simulations.every(
        ({ id, result }, index) =>
          other.simulations[index].id === id &&
          sameResult(result, other.simulations[index].result),
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

function sameResult(
  a: ComparedResult | null,
  b: ComparedResult | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    sameInvestment(a, b) &&
    a.netFinalBalance.equals(b.netFinalBalance) &&
    a.netAnnualReturn.equals(b.netAnnualReturn) &&
    a.current === b.current
  );
}
