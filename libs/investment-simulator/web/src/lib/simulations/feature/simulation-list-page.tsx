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
import {
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import { CompareIcon, PlusIcon, SimulationIcon, XIcon } from '../../ui/icons';
import { CalculationStatusTag } from '../ui/calculation-status-tag';
import {
  MAX_COMPARED,
  MIN_COMPARED,
} from '../utils/simulation-comparison-search';
import type { SimulationListItem } from '../models/simulation.types';
import { SimulationListFilterBar } from './simulation-list-filters';
import {
  useSimulationList,
  type SimulationListState,
} from './use-simulation-list';

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
      <CalculationStatusTag
        status={item.calculationStatus}
        outdated={item.result?.outdated ?? false}
      />
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

interface Selection {
  readonly selected: readonly string[];
  readonly canSelectMore: boolean;
  readonly onToggle: (id: string) => void;
}

// Above the row's stretched link, so ticking it doesn't open the simulation.
function SelectBox({
  item,
  selection,
}: {
  readonly item: SimulationListItem;
  readonly selection: Selection;
}) {
  const checked = selection.selected.includes(item.id);
  return (
    <label className="relative z-10 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-accent-soft has-disabled:cursor-default has-disabled:hover:bg-transparent">
      <input
        type="checkbox"
        className="size-5 cursor-[inherit] accent-accent"
        checked={checked}
        disabled={!checked && !selection.canSelectMore}
        onChange={() => selection.onToggle(item.id)}
      />
      <span className="sr-only">Comparar {item.offerName}</span>
    </label>
  );
}

function SimulationTable({
  items,
  search,
  selection,
}: {
  readonly items: readonly SimulationListItem[];
  readonly search: string;
  readonly selection: Selection;
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
                <span className="-my-2.5 -ml-3">
                  <SelectBox item={item} selection={selection} />
                </span>
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
  selection,
}: {
  readonly items: readonly SimulationListItem[];
  readonly search: string;
  readonly selection: Selection;
}) {
  return (
    <ul className="m-0 grid list-none p-0 lg:hidden">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start border-b border-border last:border-b-0"
        >
          <span className="pt-2.5 pl-1">
            <SelectBox item={item} selection={selection} />
          </span>
          <Link
            to={{ pathname: item.id, search }}
            className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-4 pr-4 pl-2 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft"
          >
            <span>
              <span className="block font-medium text-accent">
                {item.offerName}
              </span>
              <span className="block text-sm text-muted">
                {item.issuerName ?? 'Sem emissor'}
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

// Stays mounted so its live region announces the first selection.
function ComparisonBar({
  count,
  full,
  comparisonSearch,
  onClear,
}: {
  readonly count: number;
  readonly full: boolean;
  readonly comparisonSearch: string | null;
  readonly onClear: () => void;
}) {
  const hint =
    comparisonSearch === null
      ? `Selecione ao menos ${MIN_COMPARED} para comparar.`
      : full
        ? `Máximo de ${MAX_COMPARED}.`
        : null;
  return (
    <div
      aria-live="polite"
      className={count ? 'sticky bottom-4 z-20' : 'sr-only'}
    >
      {count > 0 && (
        <div
          role="region"
          aria-label="Simulações para comparar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-surface border-2 border-accent bg-surface px-4 py-3"
        >
          <p className="m-0">
            <span className="font-medium">
              {count} {count === 1 ? 'selecionada' : 'selecionadas'}
            </span>
            {hint && <span className="text-sm text-muted"> · {hint}</span>}
          </p>
          <div className="flex gap-2">
            <button type="button" className={quietButton} onClick={onClear}>
              Limpar
            </button>
            {comparisonSearch === null ? (
              <button type="button" className={primaryButton} disabled>
                <CompareIcon className="size-5 shrink-0" />
                Comparar
              </button>
            ) : (
              <Link
                to={{ pathname: 'comparar', search: comparisonSearch }}
                className={primaryButton}
              >
                <CompareIcon className="size-5 shrink-0" />
                Comparar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SimulationListPage() {
  const list = useSimulationList();
  const { page, state, correctedSearch, search, retry } = list;
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const selection: Selection = {
    selected: list.selected,
    canSelectMore: list.canSelectMore,
    onToggle: list.toggleSelected,
  };

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
            <SimulationTable
              items={state.items}
              search={search}
              selection={selection}
            />
            <SimulationRows
              items={state.items}
              search={search}
              selection={selection}
            />
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

      <ComparisonBar
        count={list.selected.length}
        full={!list.canSelectMore}
        comparisonSearch={list.comparisonSearch}
        onClear={list.clearSelection}
      />
    </section>
  );
}
