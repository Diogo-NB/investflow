import { CalendarDate, EAppErrorCode, Money } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { SimulationComparison } from '../simulation-comparison.vo';
import {
  comparedResult as result,
  comparedSimulation as simulation,
  REVISION,
} from './compared-simulation-fixture';

const standing = (comparison: SimulationComparison, id: string) => {
  const value = comparison.standingOf(id);
  return (
    value && {
      position: value.position,
      isLeader: value.isLeader,
      netAnnualReturnGap: value.netAnnualReturnGap.toString(),
      netBalanceGap: value.netBalanceGap?.amount.toString() ?? null,
    }
  );
};

describe('SimulationComparison value object', () => {
  it('ranks by net annual return with the gap to the leader', () => {
    const comparison = SimulationComparison.of([
      simulation('a', result({ netAnnualReturn: new Decimal('0.1028') })),
      simulation('b', result({ netAnnualReturn: new Decimal('0.1061') })),
      simulation('c', result({ netAnnualReturn: new Decimal('0.1005') })),
    ]);

    expect(standing(comparison, 'b')).toMatchObject({
      position: 1,
      isLeader: true,
      netAnnualReturnGap: '0',
    });
    expect(standing(comparison, 'a')).toMatchObject({
      position: 2,
      isLeader: false,
      netAnnualReturnGap: '0.0033',
    });
    expect(standing(comparison, 'c')).toMatchObject({
      position: 3,
      netAnnualReturnGap: '0.0056',
    });
  });

  it('keeps the calculated precision of the gap', () => {
    const comparison = SimulationComparison.of([
      simulation('a', result({ netAnnualReturn: new Decimal('0.10283746') })),
      simulation('b', result({ netAnnualReturn: new Decimal('0.1') })),
    ]);

    expect(standing(comparison, 'b')?.netAnnualReturnGap).toBe('0.00283746');
  });

  it('shares positions and leadership between ties', () => {
    const comparison = SimulationComparison.of([
      simulation('a', result({ netAnnualReturn: new Decimal('0.11') })),
      simulation('b', result({ netAnnualReturn: new Decimal('0.11') })),
      simulation('c', result({ netAnnualReturn: new Decimal('0.1') })),
    ]);

    expect(standing(comparison, 'a')).toMatchObject({
      position: 1,
      isLeader: true,
    });
    expect(standing(comparison, 'b')).toMatchObject({
      position: 1,
      isLeader: true,
    });
    expect(standing(comparison, 'c')).toMatchObject({
      position: 3,
      isLeader: false,
    });
  });

  it('leaves simulations without a result unranked', () => {
    const comparison = SimulationComparison.of([
      simulation('a', null),
      simulation('b'),
    ]);

    expect(comparison.standingOf('a')).toBeNull();
    expect(standing(comparison, 'b')).toMatchObject({
      position: 1,
      isLeader: true,
    });
    expect(comparison.isSettled).toBe(false);
    expect(comparison.areAmountsComparable).toBe(false);
  });

  it('ranks nothing when no simulation has a result', () => {
    const comparison = SimulationComparison.of([
      simulation('a', null),
      simulation('b', null),
    ]);

    expect(comparison.standingOf('a')).toBeNull();
    expect(comparison.areAmountsComparable).toBe(false);
  });

  it('gives the gap in money when principal and term are the same', () => {
    const comparison = SimulationComparison.of([
      simulation(
        'a',
        result({
          netFinalBalance: Money.of('12345.67'),
          netAnnualReturn: new Decimal('0.11'),
        }),
      ),
      simulation('b'),
      simulation('c', null),
    ]);

    expect(comparison.areAmountsComparable).toBe(true);
    expect(standing(comparison, 'a')?.netBalanceGap).toBe('0');
    expect(standing(comparison, 'b')?.netBalanceGap).toBe('345.67');
  });

  it.each([
    ['principal', { principal: Money.of('5000') }],
    ['investment date', { investmentDate: CalendarDate.of('2026-01-05') }],
    ['maturity', { maturityDate: CalendarDate.of('2027-01-04') }],
  ])('compares only rates when the %s differs', (_, overrides) => {
    const comparison = SimulationComparison.of([
      simulation('a'),
      simulation('b', result(overrides)),
    ]);

    expect(comparison.areAmountsComparable).toBe(false);
    expect(standing(comparison, 'a')?.netBalanceGap).toBeNull();
  });

  it('ranks stale results and is settled only when every simulation is', () => {
    const stale = SimulationComparison.of([
      simulation('a', result({ netAnnualReturn: new Decimal('0.2') }), {
        simulationRevision: REVISION + 1,
      }),
      simulation('b'),
    ]);
    const queued = SimulationComparison.of([
      simulation('a', result(), {
        calculationStatus: ESimulationCalculationStatus.PENDING,
      }),
      simulation('b'),
    ]);

    expect(standing(stale, 'a')).toMatchObject({ position: 1, isLeader: true });
    expect(stale.isSettled).toBe(false);
    expect(queued.isSettled).toBe(false);
    expect(
      SimulationComparison.of([simulation('a'), simulation('b')]).isSettled,
    ).toBe(true);
  });

  it.each([
    [[simulation('a')]],
    [['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => simulation(id))],
    [[simulation('a'), simulation('a')]],
  ])('holds 2 to 6 distinct simulations', (simulations) => {
    expect(() => SimulationComparison.of(simulations)).toThrow(
      expect.objectContaining({
        code: EAppErrorCode.SIMULATION_COMPARISON_INVALID,
      }),
    );
  });
});
