import { useRef, type Ref } from 'react';
import { Link, Navigate } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  formatMoney,
  formatReturnPercent,
} from '../../decimals/format-decimal';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { EmptyState } from '../../ui/empty-state';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { PaginationNav } from '../../ui/pagination-nav';
import { primaryButton, secondaryButton, surface } from '../../ui/styles';
import {
  AlertTriangleIcon,
  OfferIcon,
  PlusIcon,
  SimulationIcon,
  SpinningRefreshIcon,
  XCircleIcon,
  XIcon,
} from '../../ui/icons';
import { calculationStatusLabel } from '../utils/calculation-status';
import type { SimulationListItem } from '../models/simulation.types';
import { SimulationListFilterBar } from './simulation-list-filters';
import {
  useSimulationList,
  type SimulationListState,
} from './use-simulation-list';

const TAG_BASE =
  'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-sm font-medium';

function StatusTag({ item }: { readonly item: SimulationListItem }) {
  const label = calculationStatusLabel(item.calculationStatus);
  switch (item.calculationStatus) {
    case 'PENDING':
      return (
        <span
          className={`${TAG_BASE} border-accent/30 bg-accent-soft text-accent`}
        >
          <SpinningRefreshIcon className="size-4" />
          {label}
        </span>
      );
    case 'INVALID':
      return (
        <span
          className={`${TAG_BASE} border-warning/40 bg-warning-soft text-warning`}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          {label}
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`${TAG_BASE} border-error/40 bg-error-soft text-error`}
        >
          <XCircleIcon className="size-4 shrink-0" />
          {label}
        </span>
      );
    case 'CALCULATED':
      return item.result?.outdated ? (
        <span
          className={`${TAG_BASE} border-warning/40 bg-warning-soft text-warning`}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          Desatualizado
        </span>
      ) : null;
  }
}

function NetResult({ item }: { readonly item: SimulationListItem }) {
  return (
    <span className="grid justify-items-end gap-1 text-right">
      {item.result ? (
        <span className="font-medium tabular-nums">
          {formatMoney(item.result.netBalance)}
        </span>
      ) : (
        <span className="text-sm text-muted">Sem resultado</span>
      )}
      <StatusTag item={item} />
    </span>
  );
}

function NetAnnualReturn({ item }: { readonly item: SimulationListItem }) {
  return item.result ? (
    <>{formatReturnPercent(item.result.netAnnualReturn)} a.a.</>
  ) : (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Sem rentabilidade</span>
    </span>
  );
}

function SimulationTable({
  items,
  search,
}: {
  readonly items: readonly SimulationListItem[];
  readonly search: string;
}) {
  // Fixed widths keep the columns in place as filters and pages change rows.
  return (
    <table className="hidden w-full table-fixed border-collapse text-left lg:table">
      <caption className="sr-only">Suas simulações</caption>
      <colgroup>
        <col />
        <col className="w-48" />
        <col className="w-40" />
        <col className="w-57" />
        <col className="w-36" />
        <col className="w-45" />
      </colgroup>
      <thead>
        <tr className="border-b border-border text-sm text-muted">
          <th scope="col" className="px-4 py-3 font-medium">
            Oferta
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Remuneração
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Valor aplicado
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Período
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Rentab. líquida
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Líquido no vencimento
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          // The offer link stretches over the row, so the whole row opens the
          // simulation while staying a single link for keyboards and readers.
          <tr
            key={item.id}
            className="group relative cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-accent-soft"
          >
            <td className="px-4 py-3">
              <span className="flex items-start gap-3">
                <OfferIcon className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
                <span>
                  <Link
                    to={{ pathname: item.id, search }}
                    className="font-medium text-accent underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                  >
                    {item.offerName}
                  </Link>
                  <span className="block text-sm text-muted">
                    {item.issuerName ?? 'Sem emissor'}
                  </span>
                </span>
              </span>
            </td>
            <td className="px-4 py-3">
              {item.titleType} {remunerationLabel(item.remunerationTerms)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatMoney(item.principal)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap tabular-nums">
              {formatIsoDate(item.investmentDate)} a{' '}
              {formatIsoDate(item.maturityDate)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              <NetAnnualReturn item={item} />
            </td>
            <td className="px-4 py-3 text-right">
              <NetResult item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SimulationRows({
  items,
  search,
}: {
  readonly items: readonly SimulationListItem[];
  readonly search: string;
}) {
  return (
    <ul className="m-0 grid list-none p-0 lg:hidden">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border last:border-b-0">
          <Link
            to={{ pathname: item.id, search }}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft"
          >
            <span className="flex items-start gap-2">
              <OfferIcon className="mt-0.5 size-5 shrink-0 text-muted" />
              <span>
                <span className="block font-medium text-accent">
                  {item.offerName}
                </span>
                <span className="block text-sm text-muted">
                  {item.issuerName ?? 'Sem emissor'}
                </span>
              </span>
            </span>
            <NetResult item={item} />
            <span className="col-span-2 text-sm text-muted">
              {item.result && (
                <>
                  <span className="font-medium text-fg tabular-nums">
                    {formatReturnPercent(item.result.netAnnualReturn)} a.a.
                    líquido
                  </span>{' '}
                  ·{' '}
                </>
              )}
              {item.titleType} {remunerationLabel(item.remunerationTerms)} ·{' '}
              {formatMoney(item.principal)} ·{' '}
              <span className="whitespace-nowrap tabular-nums">
                {formatIsoDate(item.investmentDate)} a{' '}
                {formatIsoDate(item.maturityDate)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ResultSummary({
  state,
  filtered,
  ref,
}: {
  readonly state: SimulationListState;
  readonly filtered: boolean;
  readonly ref: Ref<HTMLParagraphElement>;
}) {
  const text = (() => {
    if (state.status !== 'ready') return '';
    if (state.updating) return 'Atualizando simulações…';
    if (state.total === 0) return '';
    const noun = state.total === 1 ? 'simulação' : 'simulações';
    const found = state.total === 1 ? 'encontrada' : 'encontradas';
    return filtered
      ? `${state.total} ${noun} ${found}`
      : `${state.total} ${noun}`;
  })();
  // Stays mounted so the live region exists before its text changes, and
  // receives focus when clearing the filters removes the button pressed.
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="m-0 -mb-2 min-h-6 text-sm text-muted outline-none"
    >
      {text}
      {state.status === 'ready' && !state.updating && state.total === 0 && (
        <span className="sr-only">Nenhuma simulação encontrada.</span>
      )}
    </p>
  );
}

export function SimulationListPage() {
  const list = useSimulationList();
  const { page, state, correctedSearch, search, retry } = list;
  const summaryRef = useRef<HTMLParagraphElement>(null);

  function clearFilters() {
    list.clearFilters();
    summaryRef.current?.focus();
  }

  if (correctedSearch !== null) {
    return <Navigate replace to={{ search: correctedSearch }} />;
  }

  return (
    <section aria-labelledby="simulations-title" className="grid gap-6">
      <title>Simulações | InvestFlow</title>
      <PageLabel icon={SimulationIcon}>Simulações</PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          id="simulations-title"
          icon={SimulationIcon}
          subtitle="Compare quanto cada título rende líquido no vencimento."
        >
          Simulações
        </PageTitle>
        <Link to="nova" className={primaryButton}>
          <PlusIcon className="size-5 shrink-0" />
          Nova simulação
        </Link>
      </header>

      <SimulationListFilterBar
        filters={list.filters}
        sort={list.sort}
        onChange={list.setFilter}
        onSortChange={list.setSort}
        onClear={clearFilters}
      />

      <ResultSummary ref={summaryRef} state={state} filtered={list.filtered} />

      <div
        className={surface}
        aria-busy={
          state.status === 'loading' ||
          (state.status === 'ready' && state.updating)
        }
      >
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando simulações…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar suas simulações.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={retry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' &&
          state.items.length === 0 &&
          (list.filtered ? (
            <EmptyState
              icon={SimulationIcon}
              actions={
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={clearFilters}
                >
                  <XIcon className="size-4 shrink-0" />
                  Limpar filtros
                </button>
              }
            >
              <p className="m-0">Nenhuma simulação corresponde aos filtros.</p>
            </EmptyState>
          ) : (
            <EmptyState
              icon={SimulationIcon}
              actions={
                <Link to="nova" className={secondaryButton}>
                  <PlusIcon className="size-4 shrink-0" />
                  Criar a primeira simulação
                </Link>
              }
            >
              <p className="m-0">
                Você ainda não tem simulações. Informe o valor, as datas e os
                termos de um CDB, LCI ou LCA para ver o resultado líquido no
                vencimento.
              </p>
            </EmptyState>
          ))}
        {state.status === 'ready' && state.items.length > 0 && (
          // The previous rows stay, dimmed, until the requested ones arrive.
          <div
            className={`transition-opacity duration-150 motion-safe:animate-fade-in ${state.updating ? 'opacity-50' : ''}`}
          >
            <SimulationTable items={state.items} search={search} />
            <SimulationRows items={state.items} search={search} />
          </div>
        )}
      </div>

      {state.status === 'ready' && (
        <PaginationNav
          label="Páginas de simulações"
          page={page}
          lastPage={state.lastPage}
        />
      )}
    </section>
  );
}
