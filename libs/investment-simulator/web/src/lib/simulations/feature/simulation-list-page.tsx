import { useRef, type Ref } from 'react';
import { Link, Navigate } from 'react-router';
import { EmptyState } from '../../ui/empty-state';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { PaginationNav } from '../../ui/pagination-nav';
import { primaryButton, secondaryButton, surface } from '../../ui/styles';
import { PlusIcon, SimulationIcon, XIcon } from '../../ui/icons';
import { SimulationListFilterBar } from './simulation-list-filters';
import {
  ComparisonBar,
  SimulationRows,
  SimulationTable,
  type Selection,
} from './simulation-table';
import {
  useSimulationList,
  type SimulationListState,
} from './use-simulation-list';

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
              caption="Suas simulações"
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
        selected={list.selected}
        comparisonPath={
          list.comparisonSearch &&
          `/simulacoes/comparar${list.comparisonSearch}`
        }
        onClear={list.clearSelection}
      />
    </section>
  );
}
