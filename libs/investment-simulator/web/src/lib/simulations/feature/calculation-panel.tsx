import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatInstant, formatIsoDate } from '../../dates/calendar-date';
import {
  formatMoney,
  formatPercentOf,
  formatReturnPercent,
} from '../../decimals/format-decimal';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  AlertTriangleIcon,
  CalendarIcon,
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
import { describeRemainingTerm } from '../utils/remaining-term';
import type { SaveProblem } from '../utils/simulation-save-problem';
import { MonthlyBalanceTable } from './monthly-balance-table';
import { RateOfReturnTable } from './rate-of-return-table';
import { TaxExplanationDialog } from './tax-explanation-dialog';

export interface SavedCalculation {
  readonly workspace: SimulationWorkspace;
  // The simulation was saved elsewhere after the form was loaded.
  readonly changedElsewhere: boolean;
  readonly retry: {
    readonly run: () => void;
    readonly pending: boolean;
    readonly failed: boolean;
  };
  readonly onReload: () => void;
}

interface CalculationPanelProps {
  // Null while the simulation is not saved yet.
  readonly saved: SavedCalculation | null;
  readonly pending: boolean;
  readonly problem: SaveProblem | null;
  // The form holds edits that the shown result does not include.
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
}

// Principal to net value: the gross outcome, then the taxes between them.
function summaryRows({
  principal,
  gross,
  taxes,
}: SimulationResult): readonly [string, string][] {
  const iof =
    taxes.iof.rate === null
      ? 'IOF · isento pelo prazo'
      : `IOF · ${formatPercentOf(taxes.iof.rate)}% do rendimento`;
  const incomeTax =
    taxes.incomeTax.rate === null
      ? 'Imposto de renda · isento'
      : `Imposto de renda · ${formatPercentOf(taxes.incomeTax.rate)}%`;
  return [
    ['Valor aplicado', principal],
    ['Montante bruto', gross.finalBalance],
    ['Rendimento bruto', gross.earnings],
    [iof, taxes.iof.amount],
    [incomeTax, taxes.incomeTax.amount],
    ['Total de tributos', taxes.total],
  ];
}

function StaleNotice({
  calculation,
  isSettled,
  unsavedEdits,
}: {
  readonly calculation: SimulationCalculation;
  readonly isSettled: boolean;
  readonly unsavedEdits: boolean;
}) {
  const reason = unsavedEdits
    ? 'Há alterações que ainda não foram salvas.'
    : isSettled
      ? null
      : calculation.status !== 'CALCULATED'
        ? 'Este resultado é anterior às últimas alterações.'
        : 'A simulação, a oferta, a curva ou as regras de cálculo mudaram desde este cálculo. Salve e calcule para ver o resultado atual.';
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
  readonly retry: SavedCalculation['retry'];
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
            {capitalize(describeCause(calculation))}. O resultado aparece aqui
            assim que o cálculo terminar.
          </p>
        </StatusCard>
      );
    case 'INVALID':
      return (
        <StatusCard
          key="INVALID"
          tone="warning"
          icon={<AlertTriangleIcon />}
          title={`${label} · ${describeCause(calculation)}`}
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
      // A stale result is explained next to its figures.
      if (!saved.isSettled || !result) return null;
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
  remunerationKind,
  calculation,
  isSettled,
  curve,
  unsavedEdits,
  taxRules,
}: {
  readonly simulationId: string;
  readonly result: SimulationResult;
  readonly curve: SimulationWorkspace['curve'];
  readonly remunerationKind: RemunerationKind;
  readonly calculation: SimulationCalculation;
  readonly isSettled: boolean;
  readonly unsavedEdits: boolean;
  readonly taxRules: TaxRules;
}) {
  const fetchFn = useApiFetch();
  const balances = useQuery(
    monthlyBalancesQuery(fetchFn, simulationId, result.calculatedAt),
  );
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
          calculation={calculation}
          isSettled={isSettled}
          unsavedEdits={unsavedEdits}
        />
        <div className={figures}>
          <p className="m-0 text-sm text-muted">Valor líquido no vencimento</p>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-accent tabular-nums sm:text-3xl">
              {formatMoney(result.net.finalBalance)}
            </span>
            <span className="text-sm text-muted">
              <strong className="font-semibold text-fg tabular-nums">
                {formatReturnPercent(result.net.rateOfReturn.annual)} ao ano
              </strong>
              , já descontados os tributos
            </span>
          </p>
        </div>
        <div className={figures}>
          <RateOfReturnTable
            result={result}
            remunerationKind={remunerationKind}
          />
        </div>
        <dl
          className={`m-0 grid grid-cols-[1fr_auto] gap-x-6 text-base ${figures}`}
        >
          {summaryRows(result).map(([label, amount]) => (
            <div key={label} className="contents">
              <dt className="border-b border-border py-2 text-muted">
                {label}
              </dt>
              <dd className="m-0 border-b border-border py-2 text-right tabular-nums">
                {formatMoney(amount)}
              </dd>
            </div>
          ))}
          <dt className="py-2 font-semibold">Valor líquido</dt>
          <dd className="m-0 py-2 text-right font-semibold tabular-nums">
            {formatMoney(result.net.finalBalance)}
          </dd>
        </dl>
        <TaxExplanationDialog calculation={result} rules={taxRules} />
        <p className="m-0 text-sm text-muted">
          Aplicação em {formatIsoDate(result.term.investmentDate)}, vencimento
          em {formatIsoDate(result.term.maturityDate)} ·{' '}
          {result.term.businessDays} dias úteis.{' '}
          {curve &&
            `A curva tem valores até ${formatIsoDate(curve.lastIntervalEnd)}; depois, a taxa é mantida. `}
          IOF e imposto de renda incidem no vencimento. Calculado em{' '}
          {formatInstant(result.calculatedAt)}.
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
  unsavedEdits,
  taxRules,
}: CalculationPanelProps) {
  const workspace = saved?.workspace ?? null;
  const result = workspace?.result ?? null;
  const changedElsewhere = saved?.changedElsewhere ?? false;
  return (
    <div className="grid content-start gap-6">
      {workspace?.remainingTerm && (
        <p className="m-0 flex items-center gap-2 font-medium">
          <CalendarIcon className="size-5 shrink-0 text-muted" />
          {describeRemainingTerm(workspace.remainingTerm, {
            investmentDate: workspace.simulation.investment.investmentDate,
            maturityDate: workspace.offer.maturityDate,
          })}
        </p>
      )}
      <div aria-live="polite" className="grid gap-6 empty:hidden">
        {pending ? (
          <p
            className={`${surface} m-0 flex items-center gap-3 p-6 text-muted`}
          >
            <SpinningRefreshIcon />
            Salvando…
          </p>
        ) : (
          saved && (
            <CalculationStatusNotice
              saved={saved.workspace}
              retry={saved.retry}
            />
          )
        )}
      </div>
      {!pending && (problem || changedElsewhere) && (
        <div
          role="alert"
          className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-surface border border-error/40 bg-error-soft px-5 py-4"
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
          {saved && (changedElsewhere || problem?.conflict) && (
            <button
              type="button"
              className={`${secondaryButton} col-start-2 justify-self-start`}
              onClick={saved.onReload}
            >
              <RefreshIcon className="size-5" />
              Recarregar
            </button>
          )}
        </div>
      )}
      {workspace && result ? (
        <CalculationResult
          simulationId={workspace.simulation.id}
          result={result}
          remunerationKind={workspace.offer.remunerationTerms.kind}
          calculation={workspace.calculation}
          isSettled={workspace.isSettled}
          curve={workspace.curve}
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
