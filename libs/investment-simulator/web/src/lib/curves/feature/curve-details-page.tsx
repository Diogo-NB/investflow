import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { EmptyState } from '../../ui/empty-state';
import {
  ArrowRightIcon,
  CopyIcon,
  CurveIcon,
  LockIcon,
  PencilIcon,
  SimulationIcon,
  SpinningRefreshIcon,
  TrashIcon,
} from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import {
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import {
  CONVENTION_LABELS,
  formatCurveValue,
  INDEX_LABELS,
  isMonthly,
} from '../models/curve-terms';
import type { CurveDetail } from '../models/curve.types';
import {
  useCurveDetails,
  type CurveSimulationsState,
} from './use-curve-details';

// Keeps the charting library out of the details chunk.
const CurveChart = lazy(() =>
  import('./curve-chart').then((module) => ({ default: module.CurveChart })),
);

const ConfirmDialog = lazy(() =>
  import('../../ui/confirm-dialog').then((module) => ({
    default: module.ConfirmDialog,
  })),
);

function simulationCount(total: number): string {
  return total === 1 ? '1 simulação' : `${total} simulações`;
}

function formatBoundary(curve: CurveDetail, isoDate: string): string {
  if (!isMonthly(curve.index)) return formatIsoDate(isoDate);
  const [year, month] = isoDate.split('-');
  return `${month}/${year}`;
}

function CurveTerms({ curve }: { readonly curve: CurveDetail }) {
  const first = curve.intervals[0];
  const last = curve.intervals.at(-1);
  const terms: [string, string][] = [
    ['Índice', INDEX_LABELS[curve.index]],
    ['Convenção', CONVENTION_LABELS[curve.index]],
    [
      'Cobertura',
      first && last
        ? `${formatIsoDate(first.startDate)} a ${formatIsoDate(last.endDate)}; o último valor vale em diante`
        : 'Sem intervalos',
    ],
    [
      'Origem',
      curve.origin === 'SYSTEM' ? 'Do sistema, somente leitura' : 'Minha curva',
    ],
  ];
  return (
    <dl
      className={`${surface} m-0 grid gap-x-6 gap-y-3 p-6 motion-safe:animate-fade-in sm:grid-cols-2`}
    >
      {terms.map(([label, value]) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="m-0 font-medium">{value}</dd>
        </div>
      ))}
      {curve.description && (
        <div className="grid gap-0.5 sm:col-span-2">
          <dt className="text-sm text-muted">Descrição</dt>
          <dd className="m-0 whitespace-pre-line">{curve.description}</dd>
        </div>
      )}
    </dl>
  );
}

function CurveIntervals({ curve }: { readonly curve: CurveDetail }) {
  const monthly = isMonthly(curve.index);
  return (
    <section aria-labelledby="curve-intervals-title" className="grid gap-3">
      <h2
        id="curve-intervals-title"
        className="m-0 flex items-center gap-2 text-lg font-semibold"
      >
        <CurveIcon className="size-5 shrink-0 text-accent" />
        Intervalos
      </h2>
      <div className={`${surface} overflow-hidden`}>
        <Suspense
          fallback={
            <p className="m-0 flex h-72 items-center justify-center text-sm text-muted">
              Carregando o gráfico…
            </p>
          }
        >
          <CurveChart index={curve.index} intervals={curve.intervals} />
        </Suspense>
        <div className="max-h-128 overflow-auto border-t border-border">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead className="sticky top-0 bg-bg text-sm text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  {monthly ? 'Mês inicial' : 'Início'}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {monthly ? 'Mês final' : 'Fim'}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {monthly ? 'Variação mensal' : 'Taxa anual'}
                </th>
              </tr>
            </thead>
            <tbody>
              {curve.intervals.map((interval) => (
                <tr
                  key={interval.startDate}
                  className="border-t border-border first:border-t-0"
                >
                  <td className="px-4 py-2">
                    {formatBoundary(curve, interval.startDate)}
                  </td>
                  <td className="px-4 py-2">
                    {formatBoundary(curve, interval.endDate)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurveValue(curve.index, interval.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CurveSimulations({
  curveId,
  state,
  onRetry,
}: {
  readonly curveId: string;
  readonly state: CurveSimulationsState;
  readonly onRetry: () => void;
}) {
  return (
    <section aria-labelledby="curve-simulations-title" className="grid gap-3">
      <h2
        id="curve-simulations-title"
        className="m-0 flex items-center gap-2 text-lg font-semibold"
      >
        <SimulationIcon className="size-5 shrink-0 text-accent" />
        Simulações com esta curva
      </h2>
      <div className={surface}>
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando simulações…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar as simulações.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={onRetry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.total === 0 && (
          <EmptyState icon={SimulationIcon}>
            <p className="m-0 text-muted">
              Nenhuma das suas simulações usa esta curva.
            </p>
          </EmptyState>
        )}
        {state.status === 'ready' && state.total > 0 && (
          <ul className="m-0 grid list-none p-0 motion-safe:animate-fade-in">
            {state.items.map((item) => (
              <li
                key={item.id}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  to={`/simulacoes/${item.id}`}
                  className="group flex flex-wrap items-center justify-between gap-2 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft"
                >
                  <span className="flex items-center gap-3 font-medium text-accent tabular-nums">
                    <SimulationIcon className="size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
                    {formatMoney(item.principal)}
                  </span>
                  <span className="text-sm text-muted">
                    {item.offerName} · {formatIsoDate(item.investmentDate)} a{' '}
                    {formatIsoDate(item.maturityDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.status === 'ready' && state.total > 0 && (
        <Link
          to={`/simulacoes?curveId=${curveId}`}
          className={`${quietButton} group gap-1 justify-self-start`}
        >
          Ver todas ({state.total})
          <ArrowRightIcon className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      )}
    </section>
  );
}

export function CurveDetailsPage() {
  const { curveId = '' } = useParams();
  const details = useCurveDetails(curveId);
  const { state, listSearch, duplicate, remove, simulations } = details;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const affected =
    simulations.state.status === 'ready' ? simulations.state.total : null;

  return (
    <section aria-labelledby="curve-title" className="grid gap-6">
      <title>
        {state.status === 'ready'
          ? `${state.curve.name} | InvestFlow`
          : 'Curva | InvestFlow'}
      </title>
      <PageLabel icon={CurveIcon}>
        <Link to={`/curvas${listSearch}`} className="text-accent">
          Curvas
        </Link>
      </PageLabel>
      {state.status === 'loading' && (
        <div className={surface}>
          <ListSkeleton label="Carregando curva…" />
          <span id="curve-title" hidden>
            Curva
          </span>
        </div>
      )}
      {state.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="curve-title" className="m-0 text-xl font-semibold">
            Curva não encontrada
          </h1>
          <p className="m-0 text-muted">
            Ela pode ter sido excluída. As outras curvas continuam na lista.
          </p>
          <Link to={`/curvas${listSearch}`} className={secondaryButton}>
            Ver curvas
          </Link>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="curve-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a curva
          </h1>
          <button
            type="button"
            className={secondaryButton}
            disabled={state.retrying}
            onClick={details.retry}
          >
            {state.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <PageTitle
              id="curve-title"
              icon={CurveIcon}
              subtitle={`${INDEX_LABELS[state.curve.index]} · ${CONVENTION_LABELS[state.curve.index].toLowerCase()}`}
            >
              {state.curve.name}
            </PageTitle>
            <div className="flex flex-wrap gap-2">
              {state.curve.origin === 'OWN' && (
                <Link to={`editar${listSearch}`} className={primaryButton}>
                  <PencilIcon className="size-4 shrink-0" />
                  Editar
                </Link>
              )}
              <button
                type="button"
                // A system curve's only action.
                className={
                  state.curve.origin === 'SYSTEM'
                    ? primaryButton
                    : secondaryButton
                }
                disabled={duplicate.pending}
                onClick={duplicate.run}
              >
                {duplicate.pending ? (
                  <SpinningRefreshIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4 shrink-0" />
                )}
                {duplicate.pending ? 'Duplicando…' : 'Duplicar'}
              </button>
              {state.curve.origin === 'OWN' && (
                <button
                  type="button"
                  className={`${quietButton} gap-2 text-error`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon className="size-4 shrink-0" />
                  Excluir
                </button>
              )}
            </div>
          </header>
          {duplicate.failed && (
            <p role="alert" className="m-0 text-sm text-error">
              Não foi possível duplicar. Tente novamente.
            </p>
          )}
          {state.curve.origin === 'SYSTEM' && (
            <div className="flex max-w-2xl items-start gap-3 rounded-control border border-border bg-accent-soft p-4">
              <LockIcon className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="grid gap-1">
                <p className="m-0 font-medium">
                  Curva do sistema: somente leitura
                </p>
                <p className="m-0 text-sm text-muted">
                  Mantida pelo sistema para todos os usuários, ela não pode ser
                  editada nem excluída. Duplique para ter uma cópia sua e
                  alterar os intervalos.
                </p>
              </div>
            </div>
          )}
          <CurveTerms curve={state.curve} />
          <CurveIntervals curve={state.curve} />
          <CurveSimulations
            curveId={curveId}
            state={simulations.state}
            onRetry={simulations.retry}
          />
        </>
      )}
      {confirmingDelete && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            onOpenChange={setConfirmingDelete}
            title="Excluir esta curva?"
            description={
              <>
                A exclusão é definitiva.{' '}
                {affected === null
                  ? 'As simulações que usam esta curva ficarão sem curva (Sem curva, escolha outra).'
                  : affected === 0
                    ? 'Nenhuma das suas simulações usa esta curva.'
                    : `${simulationCount(affected)} ${affected === 1 ? 'ficará' : 'ficarão'} sem curva (Sem curva, escolha outra).`}{' '}
                Cópias desta curva não são afetadas.
              </>
            }
            cancelLabel="Cancelar"
            confirmLabel={remove.pending ? 'Excluindo…' : 'Excluir curva'}
            destructive
            pending={remove.pending}
            error={
              remove.failed
                ? 'Não foi possível excluir. Tente novamente.'
                : undefined
            }
            onConfirm={remove.run}
          />
        </Suspense>
      )}
    </section>
  );
}
