import { formatMoney } from '../../../decimals/format-decimal';
import {
  simulationResult,
  workspace,
} from '../../../testing/simulator-fixtures';
import type {
  ComparedSimulation,
  ComparisonStanding,
  SimulationComparison,
} from '../../models/simulation.types';
import {
  comparisonLabels,
  COMPARISON_ROW_GROUPS,
  onlyDifferences,
  rankedOrder,
  rankingMark,
} from '../comparison-rows';

function compared(
  id: string,
  standing: Partial<ComparisonStanding> | null = {},
  principal = '10000',
): ComparedSimulation {
  return {
    ...workspace,
    simulation: {
      ...workspace.simulation,
      id,
      investment: { ...workspace.simulation.investment, principal },
    },
    result: simulationResult(),
    isSettled: true,
    standing: standing && {
      position: 1,
      isLeader: true,
      netAnnualReturnGap: '0',
      netBalanceGap: null,
      ...standing,
    },
  };
}

const comparison = (
  areAmountsComparable: boolean,
  simulations: ComparedSimulation[] = [],
): SimulationComparison => ({
  isSettled: true,
  areAmountsComparable,
  simulations,
});

const row = (label: string) => {
  const found = COMPARISON_ROW_GROUPS.flatMap(({ rows }) => rows).find(
    (candidate) => candidate.label === label,
  );
  if (!found) throw new Error(`No row ${label}`);
  return found;
};

describe('onlyDifferences', () => {
  it('keeps only rows whose values differ and drops empty groups', () => {
    const groups = onlyDifferences(COMPARISON_ROW_GROUPS, [
      compared('a'),
      compared('b', {}, '5000'),
    ]);

    expect(groups.map(({ title }) => title)).toEqual(['Premissas']);
    expect(groups[0].rows.map(({ label }) => label)).toEqual([
      'Valor aplicado',
    ]);
  });

  it('treats a missing result as a different value', () => {
    const withoutResult = { ...compared('b', null), result: null };

    expect(
      onlyDifferences(COMPARISON_ROW_GROUPS, [compared('a'), withoutResult])
        .length,
    ).toBe(3);
  });
});

describe('rankingMark', () => {
  const leader = compared('a');
  const second = compared('b', {
    position: 2,
    isLeader: false,
    netAnnualReturnGap: '0.0033',
    netBalanceGap: '67.6',
  });

  it('marks the leader and the gap in the annual return', () => {
    const annual = row('Rentabilidade ao ano');

    expect(rankingMark(annual, leader, comparison(false))).toEqual({
      best: true,
      gap: null,
    });
    expect(rankingMark(annual, second, comparison(false))).toEqual({
      best: false,
      gap: '0,33 p.p. abaixo',
    });
  });

  it('marks amounts only when they are comparable', () => {
    const amount = row('Montante líquido');

    expect(rankingMark(amount, second, comparison(false))).toBeNull();
    expect(rankingMark(amount, second, comparison(true))).toMatchObject({
      best: false,
    });
    expect(rankingMark(row('IOF'), leader, comparison(true))).toBeNull();
  });

  it('leaves unranked simulations unmarked', () => {
    expect(
      rankingMark(
        row('Rentabilidade ao ano'),
        compared('c', null),
        comparison(false),
      ),
    ).toBeNull();
  });
});

describe('rankedOrder', () => {
  it('orders by position and leaves unranked last', () => {
    const order = rankedOrder([
      compared('unranked', null),
      compared('third', { position: 3, isLeader: false }),
      compared('first'),
    ]);

    expect(order.map(({ simulation }) => simulation.id)).toEqual([
      'first',
      'third',
      'unranked',
    ]);
  });
});

describe('comparisonLabels', () => {
  const withIssuer = (id: string, issuerName: string) => {
    const simulation = compared(id);
    return { ...simulation, offer: { ...simulation.offer, issuerName } };
  };
  const withRate = (id: string, rate: string) => {
    const simulation = compared(id);
    return {
      ...simulation,
      offer: {
        ...simulation.offer,
        remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate },
      },
    };
  };

  it('names each simulation by its terms while they differ', () => {
    const labels = comparisonLabels([
      withRate('a', '1.05'),
      withRate('b', '1.1'),
    ]);

    expect(labels.get('a')).toEqual({
      name: 'CDB 105% do CDI',
      investment: null,
    });
    expect(labels.get('b')?.name).toBe('CDB 110% do CDI');
  });

  it('adds the issuer when the terms repeat, and the investment when both do', () => {
    const labels = comparisonLabels([
      withIssuer('a', 'Banco A'),
      withIssuer('b', 'Banco B'),
      compared('c', {}, '10000'),
      compared('d', {}, '5000'),
    ]);

    expect(labels.get('a')?.name).toBe('CDB 105% do CDI · Banco A · Reserva');
    const investment = `${formatMoney('10000')} de 02/01/2026`;
    expect(labels.get('c')).toEqual({
      name: `CDB 105% do CDI · Banco Local · Reserva · ${investment}`,
      investment,
    });
  });
});
