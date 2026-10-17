import { formatIsoDate } from '../../dates/calendar-date';
import {
  formatMoney,
  formatPercentagePoints,
  formatPercentOf,
  formatReturnPercent,
} from '../../decimals/format-decimal';
import {
  REDEMPTION_LABELS,
  remunerationLabel,
} from '../../offers/models/offer-terms';
import type {
  ComparedSimulation,
  SimulationComparison,
  SimulationResult,
  Tax,
} from '../models/simulation.types';
import { describeRemainingTerm } from './remaining-term';

export interface ComparisonRow {
  readonly label: string;
  readonly value: (simulation: ComparedSimulation) => string;
  // The measure the ranking marks with the leader and the gap to it.
  readonly ranking?: 'netAnnualReturn' | 'netBalance';
}

export interface ComparisonRowGroup {
  readonly title: string;
  readonly rows: readonly ComparisonRow[];
}

const NONE = '—';

const fromResult =
  (read: (result: SimulationResult) => string) =>
  ({ result }: ComparedSimulation) =>
    result ? read(result) : NONE;

const tax = ({ rate, amount }: Tax) =>
  rate === null
    ? 'Isento'
    : `${formatMoney(amount)} (${formatPercentOf(rate)}%)`;

// The ranked measure, also the headline of each simulation on small screens.
export const NET_ANNUAL_RETURN_ROW: ComparisonRow = {
  label: 'Rentabilidade ao ano',
  value: fromResult(({ net }) => formatReturnPercent(net.rateOfReturn.annual)),
  ranking: 'netAnnualReturn',
};

export const COMPARISON_ROW_GROUPS: readonly ComparisonRowGroup[] = [
  {
    title: 'Premissas',
    rows: [
      {
        label: 'Título',
        value: ({ offer }) =>
          offer.issuerName
            ? `${offer.titleType} · ${offer.issuerName}`
            : offer.titleType,
      },
      {
        label: 'Remuneração',
        value: ({ offer }) => remunerationLabel(offer.remunerationTerms),
      },
      {
        label: 'Curva',
        value: ({ curve }) =>
          curve ? `${curve.name}${curve.deleted ? ' (excluída)' : ''}` : NONE,
      },
      {
        label: 'Liquidez',
        value: ({ offer }) => REDEMPTION_LABELS[offer.redemptionTerms.kind],
      },
      {
        label: 'Valor aplicado',
        value: ({ simulation }) => formatMoney(simulation.investment.principal),
      },
      {
        label: 'Aplicação',
        value: ({ simulation }) =>
          formatIsoDate(simulation.investment.investmentDate),
      },
      {
        label: 'Vencimento',
        value: ({ offer }) => formatIsoDate(offer.maturityDate),
      },
      {
        label: 'Prazo restante',
        value: ({ remainingTerm, simulation, offer }) =>
          remainingTerm
            ? describeRemainingTerm(remainingTerm, {
                investmentDate: simulation.investment.investmentDate,
                maturityDate: offer.maturityDate,
              })
            : NONE,
      },
    ],
  },
  {
    title: 'Líquido',
    rows: [
      NET_ANNUAL_RETURN_ROW,
      {
        label: 'Rentabilidade ao mês',
        value: fromResult(({ net }) =>
          formatReturnPercent(net.rateOfReturn.monthly),
        ),
      },
      {
        label: 'Rentabilidade no período',
        value: fromResult(({ net }) =>
          formatReturnPercent(net.rateOfReturn.forPeriod),
        ),
      },
      {
        label: 'Montante líquido',
        value: fromResult(({ net }) => formatMoney(net.finalBalance)),
        ranking: 'netBalance',
      },
      {
        label: 'Rendimento líquido',
        value: fromResult(({ net }) => formatMoney(net.earnings)),
      },
    ],
  },
  {
    title: 'Tributos',
    rows: [
      { label: 'IOF', value: fromResult(({ taxes }) => tax(taxes.iof)) },
      {
        label: 'Imposto de renda',
        value: fromResult(({ taxes }) => tax(taxes.incomeTax)),
      },
      {
        label: 'Total de tributos',
        value: fromResult(({ taxes }) => formatMoney(taxes.total)),
      },
    ],
  },
  {
    title: 'Bruto',
    rows: [
      {
        label: 'Montante bruto',
        value: fromResult(({ gross }) => formatMoney(gross.finalBalance)),
      },
      {
        label: 'Rendimento bruto',
        value: fromResult(({ gross }) => formatMoney(gross.earnings)),
      },
      {
        label: 'Rentabilidade bruta ao ano',
        value: fromResult(({ gross }) =>
          formatReturnPercent(gross.rateOfReturn.annual),
        ),
      },
    ],
  },
];

/** Only the rows whose shown values differ, dropping groups left empty. */
export function onlyDifferences(
  groups: readonly ComparisonRowGroup[],
  simulations: readonly ComparedSimulation[],
): readonly ComparisonRowGroup[] {
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) => new Set(simulations.map(row.value)).size > 1,
      ),
    }))
    .filter((group) => group.rows.length > 0);
}

/**
 * How a ranked measure marks one simulation: best, or how far behind the
 * leader. Null when the row ranks nothing, the simulation is unranked, or the
 * amounts are not comparable.
 */
export function rankingMark(
  row: ComparisonRow,
  { standing }: ComparedSimulation,
  { amountsComparable }: SimulationComparison,
): { readonly best: boolean; readonly gap: string | null } | null {
  if (!row.ranking || !standing) return null;
  if (row.ranking === 'netAnnualReturn') {
    return {
      best: standing.leader,
      gap: standing.leader
        ? null
        : `${formatPercentagePoints(standing.netAnnualReturnGap)} abaixo`,
    };
  }
  if (!amountsComparable || standing.netBalanceGap === null) return null;
  return {
    best: standing.leader,
    gap: standing.leader
      ? null
      : `${formatMoney(standing.netBalanceGap)} a menos`,
  };
}

/** By position, leaders first; simulations without a result last. */
export function rankedOrder(
  simulations: readonly ComparedSimulation[],
): readonly ComparedSimulation[] {
  return [...simulations].sort(
    (a, b) =>
      (a.standing?.position ?? Infinity) - (b.standing?.position ?? Infinity),
  );
}
