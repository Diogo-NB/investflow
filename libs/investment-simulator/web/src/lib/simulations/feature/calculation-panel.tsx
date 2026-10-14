import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatInstant, formatIsoDate } from '../../dates/calendar-date';
import { formatMoney, formatPercentOf } from '../../decimals/format-decimal';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CurveIcon,
  RefreshIcon,
  SpinningRefreshIcon,
  XCircleIcon,
} from '../../ui/icons';
import { secondaryButton, surface } from '../../ui/styles';
import { monthlyBalancesQuery } from '../api/simulation-api';
import type {
  SimulationCalculation,
  SimulationResult,
  SimulationWorkspace,
  TaxRules,
} from '../models/simulation.types';
import {
  calculationStatusLabel,
  describeCause,
  describeReason,
} from '../utils/calculation-status';
import type { SaveProblem } from './use-simulation-workspace';
import { MonthlyBalanceTable } from './monthly-balance-table';
import { TaxExplanationDialog } from './tax-explanation-dialog';

interface CalculationPanelProps {
  // Null while the simulation is not saved yet.
  readonly saved: SimulationWorkspace | null;
  readonly pending: boolean;
  readonly problem: SaveProblem | null;
  // The simulation was saved elsewhere after the form was loaded.
  readonly changedElsewhere: boolean;
  // The form holds edits that the shown result does not include.
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
  readonly retry: {
    readonly run: () => void;
    readonly pending: boolean;
    readonly failed: boolean;
  };
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
  calculation,
  unsavedEdits,
}: {
  readonly result: SimulationResult;
  readonly calculation: SimulationCalculation;
  readonly unsavedEdits: boolean;
}) {
  const reason = unsavedEdits
    ? 'Há alterações que ainda não foram salvas.'
    : calculation.status !== 'CALCULATED'
      ? 'Este resultado é anterior às últimas alterações.'
      : result.outdated
        ? 'A simulação, a oferta, a curva ou a metodologia de cálculo mudou desde este cálculo. Salve e calcule para ver o resultado atual.'
        : null;
  if (!reason) return null;
  return (
    <p className="m-0 flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
      <AlertTriangleIcon className="mt-px size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Desatualizado.</strong> {reason}
      </span>
    </p>
  );
}

type StatusTone = 'progress' | 'success' | 'warning' | 'error';

const TONE_CLASSES: Record<StatusTone, { box: string; title: string }> = {
  progress: { box: 'border-accent/30 bg-accent-soft', title: 'text-accent' },
  success: { box: 'border-accent/30 bg-accent-soft', title: 'text-accent' },
  warning: { box: 'border-warning/40 bg-warning-soft', title: 'text-warning' },
  error: { box: 'border-error/40 bg-error-soft', title: 'text-error' },
};

function StatusCard({
  tone,
  icon,
  title,
  children,
}: {
  readonly tone: StatusTone;
  readonly icon: ReactNode;
  readonly title: string;
  readonly children?: ReactNode;
}) {
  const classes = TONE_CLASSES[tone];
  return (
    <div
      className={`grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-surface border px-5 py-4 motion-safe:animate-fade-in ${classes.box}`}
    >
      <span className={`mt-0.5 ${classes.title}`}>{icon}</span>
      <p className={`m-0 font-semibold ${classes.title}`}>{title}</p>
      {children && (
        <div className="col-start-2 grid justify-items-start gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

function CalculationStatusNotice({
  saved,
  retry,
}: {
  readonly saved: SimulationWorkspace;
  readonly retry: CalculationPanelProps['retry'];
}) {
  const { calculation, result } = saved;
  const label = calculationStatusLabel(calculation.status);
  // Keyed by status so each change replays the entrance.
  switch (calculation.status) {
    case 'PENDING':
      return (
        <StatusCard
          key="PENDING"
          tone="progress"
          icon={<SpinningRefreshIcon />}
          title={`${label}…`}
        >
          <p className="m-0 text-sm text-fg">
            {capitalize(describeCause(calculation, saved))}. O resultado aparece
            aqui assim que o cálculo terminar.
          </p>
        </StatusCard>
      );
    case 'INVALID':
      return (
        <StatusCard
          key="INVALID"
          tone="warning"
          icon={<AlertTriangleIcon />}
          title={`${label} · ${describeCause(calculation, saved)}`}
        >
          {calculation.reason && (
            <p className="m-0 text-fg">{describeReason(calculation.reason)}</p>
          )}
          {calculation.reason?.code === 'INVESTMENT_CURVE_COVERAGE_MISSING' &&
            saved.curve &&
            !saved.curve.deleted && (
              <Link
                to={`/curvas/${saved.curve.id}`}
                className={secondaryButton}
              >
                <CurveIcon className="size-4 shrink-0" />
                Ver curva {saved.curve.name}
              </Link>
            )}
        </StatusCard>
      );
    case 'FAILED':
      return (
        <StatusCard
          key="FAILED"
          tone="error"
          icon={<XCircleIcon />}
          title={label ?? ''}
        >
          <p className="m-0 text-fg">
            Não foi possível calcular depois de várias tentativas automáticas.
          </p>
          {retry.failed && (
            <p className="m-0 text-error">
              Não foi possível pedir um novo cálculo. Tente novamente.
            </p>
          )}
          <button
            type="button"
            className={secondaryButton}
            disabled={retry.pending}
            onClick={retry.run}
          >
            {retry.pending ? (
              <SpinningRefreshIcon />
            ) : (
              <RefreshIcon className="size-5" />
            )}
            {retry.pending ? 'Pedindo…' : 'Tentar novamente'}
          </button>
        </StatusCard>
      );
    case 'CALCULATED':
      // An outdated result is explained next to its figures.
      if (!result || result.outdated) return null;
      return (
        <StatusCard
          key="CALCULATED"
          tone="success"
          icon={<CheckCircleIcon />}
          title={`Atualizado · calculado em ${formatInstant(result.calculatedAt)}`}
        />
      );
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function CalculationResult({
  simulationId,
  result,
  calculation,
  unsavedEdits,
  taxRules,
}: {
  readonly simulationId: string;
  readonly result: SimulationResult;
  readonly calculation: SimulationCalculation;
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
}) {
  const fetchFn = useApiFetch();
  const balances = useQuery(
    monthlyBalancesQuery(fetchFn, simulationId, result.calculatedAt),
  );
  const summary = result.maturitySummary;
  // Figures recede while a newer calculation is on its way.
  const figures = `transition-opacity duration-300 ${calculation.status === 'PENDING' ? 'opacity-60' : ''}`;
  return (
    // Keyed by the calculation instant, so a new result fades in.
    <section
      key={result.calculatedAt}
      aria-labelledby="result-title"
      className={`${surface} motion-safe:animate-fade-in`}
    >
      <div className="grid gap-5 p-6">
        <h2 id="result-title" className="m-0 text-lg font-semibold">
          Resultado no vencimento
        </h2>
        <StaleNotice
          result={result}
          calculation={calculation}
          unsavedEdits={unsavedEdits}
        />
        <div className={figures}>
          <p className="m-0 text-sm text-muted">Valor líquido no vencimento</p>
          <p className="m-0 text-2xl font-semibold text-accent tabular-nums sm:text-3xl">
            {formatMoney(summary.netBalance)}
          </p>
        </div>
        <dl
          className={`m-0 grid grid-cols-[1fr_auto] gap-x-6 text-base ${figures}`}
        >
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
  saved,
  pending,
  problem,
  changedElsewhere,
  unsavedEdits,
  taxRules,
  retry,
  onReload,
}: CalculationPanelProps) {
  const result = saved?.result ?? null;
  return (
    <div className="grid content-start gap-6">
      <div aria-live="polite" className="grid gap-6 empty:hidden">
        {pending ? (
          <p
            className={`${surface} m-0 flex items-center gap-3 p-6 text-muted`}
          >
            <SpinningRefreshIcon />
            Salvando…
          </p>
        ) : (
          saved && <CalculationStatusNotice saved={saved} retry={retry} />
        )}
      </div>
      {!pending && (problem || changedElsewhere) && (
        <div
          role="alert"
          className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 rounded-surface border border-error/40 bg-error-soft px-5 py-4"
        >
          <XCircleIcon className="mt-0.5 size-5 shrink-0 text-error" />
          {problem ? (
            <div className="grid gap-1">
              <p className="m-0 font-semibold text-error">
                Não foi possível salvar.
              </p>
              <p className="m-0">{problem.message}</p>
            </div>
          ) : (
            <p className="m-0">
              Esta simulação foi alterada em outro lugar. Recarregue para ver a
              versão salva.
            </p>
          )}
          {(changedElsewhere || problem?.conflict) && (
            <button
              type="button"
              className={`${secondaryButton} col-start-2 justify-self-start`}
              onClick={onReload}
            >
              <RefreshIcon className="size-5" />
              Recarregar
            </button>
          )}
        </div>
      )}
      {saved && result ? (
        <CalculationResult
          simulationId={saved.simulation.id}
          result={result}
          calculation={saved.calculation}
          unsavedEdits={unsavedEdits}
          taxRules={taxRules}
        />
      ) : (
        !pending &&
        !saved && (
          <p className={`${surface} m-0 p-6 text-muted`}>
            Preencha os dados e salve para ver o resultado no vencimento.
          </p>
        )
      )}
    </div>
  );
}
