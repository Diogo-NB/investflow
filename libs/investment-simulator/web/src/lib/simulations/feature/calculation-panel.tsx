import { useQuery } from '@tanstack/react-query';
import { formatInstant, formatIsoDate } from '../../dates/calendar-date';
import { formatMoney, formatPercentOf } from '../../decimals/format-decimal';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { secondaryButton, surface } from '../../ui/styles';
import { monthlyBalancesQuery } from '../api/simulation-api';
import type { SimulationResult, TaxRules } from '../models/simulation.types';
import type { SaveProblem } from './use-simulation-workspace';
import { MonthlyBalanceTable } from './monthly-balance-table';
import { TaxExplanationDialog } from './tax-explanation-dialog';

interface CalculationPanelProps {
  readonly simulationId: string | null;
  readonly result: SimulationResult | null;
  readonly pending: boolean;
  readonly problem: SaveProblem | null;
  // The form holds edits that the shown result does not include.
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
  readonly onReload: () => void;
}

type SummaryKey = keyof SimulationResult['maturitySummary'];

function rowLabel(
  key: SummaryKey,
  label: string,
  taxes: SimulationResult['taxes'],
): string {
  if (key === 'iof') {
    return taxes.iof.rate === null
      ? `${label} · isento pelo prazo`
      : `${label} · ${formatPercentOf(taxes.iof.rate)}% do rendimento`;
  }
  if (key === 'incomeTax') {
    return taxes.incomeTax.rate === null
      ? `${label} · isento`
      : `${label} · ${formatPercentOf(taxes.incomeTax.rate)}%`;
  }
  return label;
}

const SUMMARY_ROWS: readonly [SummaryKey, string][] = [
  ['principal', 'Valor aplicado'],
  ['grossBalance', 'Montante bruto'],
  ['grossEarnings', 'Rendimento bruto'],
  ['iof', 'IOF'],
  ['incomeTax', 'Imposto de renda'],
  ['totalTaxes', 'Total de tributos'],
];

function StaleNotice({
  result,
  unsavedEdits,
}: {
  readonly result: SimulationResult;
  readonly unsavedEdits: boolean;
}) {
  if (!result.outdated && !unsavedEdits) return null;
  return (
    <p className="m-0 rounded-control border border-warning px-4 py-3 text-sm text-warning">
      <strong className="font-semibold">Desatualizado.</strong>{' '}
      {unsavedEdits
        ? 'Há alterações que ainda não foram calculadas.'
        : 'A simulação, a oferta, a curva ou a metodologia de cálculo mudou desde este cálculo.'}{' '}
      Salve e calcule para ver o resultado atual.
    </p>
  );
}

function CalculationResult({
  simulationId,
  result,
  unsavedEdits,
  taxRules,
}: {
  readonly simulationId: string;
  readonly result: SimulationResult;
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
}) {
  const fetchFn = useApiFetch();
  const balances = useQuery(
    monthlyBalancesQuery(fetchFn, simulationId, result.calculatedAt),
  );
  const summary = result.maturitySummary;
  return (
    <section aria-labelledby="result-title" className={surface}>
      <div className="grid gap-5 p-6">
        <h2 id="result-title" className="m-0 text-lg font-semibold">
          Resultado no vencimento
        </h2>
        <StaleNotice result={result} unsavedEdits={unsavedEdits} />
        <div>
          <p className="m-0 text-sm text-muted">Valor líquido no vencimento</p>
          <p className="m-0 text-2xl font-semibold tabular-nums sm:text-3xl">
            {formatMoney(summary.netBalance)}
          </p>
        </div>
        <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-6 text-base">
          {SUMMARY_ROWS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="border-b border-border py-2 text-muted">
                {rowLabel(key, label, result.taxes)}
              </dt>
              <dd className="m-0 border-b border-border py-2 text-right tabular-nums">
                {formatMoney(summary[key])}
              </dd>
            </div>
          ))}
          <dt className="py-2 font-semibold">Valor líquido</dt>
          <dd className="m-0 py-2 text-right font-semibold tabular-nums">
            {formatMoney(summary.netBalance)}
          </dd>
        </dl>
        <TaxExplanationDialog calculation={result} rules={taxRules} />
        <p className="m-0 text-sm text-muted">
          Aplicação em {formatIsoDate(result.investmentDate)}, vencimento em{' '}
          {formatIsoDate(result.maturityDate)} · {result.businessDays} dias
          úteis. IOF e imposto de renda incidem no vencimento. Calculado em{' '}
          {formatInstant(result.calculatedAt)} · metodologia{' '}
          {result.methodologyVersion}.
        </p>
      </div>
      {balances.data ? (
        <MonthlyBalanceTable
          key={result.calculatedAt}
          months={balances.data.items}
        />
      ) : (
        <p className="m-0 border-t border-border px-6 py-3 text-sm text-muted">
          {balances.isError
            ? 'Não foi possível carregar a evolução do saldo.'
            : 'Carregando a evolução do saldo…'}
        </p>
      )}
    </section>
  );
}

export function CalculationPanel({
  simulationId,
  result,
  pending,
  problem,
  unsavedEdits,
  taxRules,
  onReload,
}: CalculationPanelProps) {
  return (
    <div className="grid content-start gap-6">
      <div aria-live="polite" className="empty:hidden">
        {pending && (
          <p className={`${surface} m-0 p-6 text-muted`}>
            Salvando e calculando…
          </p>
        )}
      </div>
      {!pending && problem && (
        <div
          role="alert"
          className={`${surface} grid justify-items-start gap-3 border-error p-6`}
        >
          <div className="grid gap-1">
            <p className="m-0 font-semibold text-error">
              Não foi possível salvar.
            </p>
            <p className="m-0">{problem.message}</p>
          </div>
          {problem.conflict && (
            <button
              type="button"
              className={secondaryButton}
              onClick={onReload}
            >
              Recarregar
            </button>
          )}
        </div>
      )}
      {simulationId && result ? (
        <CalculationResult
          simulationId={simulationId}
          result={result}
          unsavedEdits={unsavedEdits}
          taxRules={taxRules}
        />
      ) : (
        !pending && (
          <p className={`${surface} m-0 p-6 text-muted`}>
            Preencha os dados e salve para ver o resultado no vencimento.
          </p>
        )
      )}
    </div>
  );
}
