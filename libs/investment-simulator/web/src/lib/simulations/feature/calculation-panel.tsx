import { Link } from 'react-router';
import { formatInstant, formatIsoDate } from '../../dates/calendar-date';
import { formatMoney, formatPercentOf } from '../../decimals/format-decimal';
import { surface } from '../../ui/styles';
import type { CalculationSummary, TaxRules } from '../models/simulation.types';
import type { CalculationProblem } from './use-simulation-workspace';
import { MonthlyBalanceTable } from './monthly-balance-table';
import { TaxExplanationDialog } from './tax-explanation-dialog';
import type { useCalculationHistory } from './use-calculation-history';

type History = ReturnType<typeof useCalculationHistory>;

interface CalculationPanelProps {
  readonly history: History;
  readonly pending: boolean;
  readonly problem: CalculationProblem | null;
  // The form holds edits that the shown calculation does not include.
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
  // The saved simulation's maturity; every calculation shares it.
  readonly maturityDate: string | null;
}

type SummaryKey = keyof CalculationSummary['maturitySummary'];

function rowLabel(
  key: SummaryKey,
  label: string,
  taxes: CalculationSummary['taxes'],
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
  calculation,
  history,
  unsavedEdits,
}: {
  readonly calculation: CalculationSummary;
  readonly history: History;
  readonly unsavedEdits: boolean;
}) {
  if (history.viewingPast && history.latest) {
    return (
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-accent-soft px-4 py-3 text-sm">
        <span>
          Você está vendo um cálculo anterior, de{' '}
          {formatInstant(calculation.calculatedAt)}.
        </span>
        <Link
          to={{ search: history.searchFor(history.latest.id) }}
          replace
          preventScrollReset
          className="font-medium text-accent"
        >
          Ver o mais recente
        </Link>
      </p>
    );
  }
  if (calculation.outdated || unsavedEdits) {
    return (
      <p className="m-0 rounded-control border border-warning px-4 py-3 text-sm text-warning">
        <strong className="font-semibold">Desatualizado.</strong>{' '}
        {unsavedEdits
          ? 'Há alterações que ainda não foram calculadas.'
          : 'A metodologia de cálculo mudou desde este cálculo.'}{' '}
        Calcule novamente para ver o resultado atual.
      </p>
    );
  }
  return null;
}

function CalculationResult({
  calculation,
  maturityDate,
  history,
  unsavedEdits,
  taxRules,
}: {
  readonly calculation: CalculationSummary;
  readonly maturityDate: string;
  readonly history: History;
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
}) {
  const summary = calculation.maturitySummary;
  const balances = history.monthlyBalances;
  return (
    <section aria-labelledby="result-title" className={surface}>
      <div className="grid gap-5 p-6">
        <h2 id="result-title" className="m-0 text-lg font-semibold">
          Resultado no vencimento
        </h2>
        <StaleNotice
          calculation={calculation}
          history={history}
          unsavedEdits={unsavedEdits}
        />
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
                {rowLabel(key, label, calculation.taxes)}
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
        <TaxExplanationDialog
          calculation={calculation}
          maturityDate={maturityDate}
          rules={taxRules}
        />
        <p className="m-0 text-sm text-muted">
          Aplicação em {formatIsoDate(calculation.investment.investmentDate)},
          vencimento em {formatIsoDate(maturityDate)} ·{' '}
          {calculation.businessDays} dias úteis. IOF e imposto de renda incidem
          no vencimento. Calculado em {formatInstant(calculation.calculatedAt)}{' '}
          · metodologia {calculation.methodologyVersion}.
        </p>
      </div>
      {balances.data ? (
        <MonthlyBalanceTable
          key={calculation.id}
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

function CalculationHistory({ history }: { readonly history: History }) {
  if (history.items.length < 2) return null;
  return (
    <details className={surface}>
      <summary className="flex min-h-11 cursor-pointer items-center px-6 font-medium text-accent">
        Histórico de cálculos ({history.items.length})
      </summary>
      <ol className="m-0 grid list-none border-t border-border p-0">
        {history.items.map((item, position) => (
          <li key={item.id} className="border-b border-border last:border-b-0">
            <Link
              to={{ search: history.searchFor(item.id) }}
              replace
              preventScrollReset
              aria-current={
                item.id === history.selected?.id ? 'true' : undefined
              }
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-2 text-fg no-underline hover:bg-accent-soft aria-current:bg-accent-soft"
            >
              <span>
                {formatInstant(item.calculatedAt)}
                {position === 0 && (
                  <span className="text-muted"> · mais recente</span>
                )}
              </span>
              <span className="flex items-center gap-3">
                {item.outdated && (
                  <span className="text-sm text-warning">Desatualizado</span>
                )}
                <span className="tabular-nums">
                  {formatMoney(item.maturitySummary.netBalance)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function CalculationPanel({
  history,
  pending,
  problem,
  unsavedEdits,
  taxRules,
  maturityDate,
}: CalculationPanelProps) {
  const calculation = history.selected;
  return (
    <div className="grid content-start gap-6">
      <div aria-live="polite" className="empty:hidden">
        {pending && (
          <p className={`${surface} m-0 p-6 text-muted`}>Calculando…</p>
        )}
      </div>
      {!pending && problem && (
        <div role="alert" className={`${surface} grid gap-1 border-error p-6`}>
          <p className="m-0 font-semibold text-error">
            Não foi possível calcular.
          </p>
          <p className="m-0">{problem.message}</p>
        </div>
      )}
      {calculation && maturityDate ? (
        <CalculationResult
          calculation={calculation}
          maturityDate={maturityDate}
          history={history}
          unsavedEdits={unsavedEdits && !history.viewingPast}
          taxRules={taxRules}
        />
      ) : (
        !pending && (
          <p className={`${surface} m-0 p-6 text-muted`}>
            Preencha os dados e calcule para ver o resultado no vencimento.
          </p>
        )
      )}
      <CalculationHistory history={history} />
    </div>
  );
}
