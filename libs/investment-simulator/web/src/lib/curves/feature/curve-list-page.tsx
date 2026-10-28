import { Link, Navigate } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import { ORIGIN_LABELS } from '../../offers/utils/offer-groups';
import { EmptyState } from '../../ui/empty-state';
import { FormField } from '../../ui/form-field';
import { CurveIcon, PlusIcon } from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { SelectField, type SelectOption } from '../../ui/select-field';
import { primaryButton, secondaryButton, surface } from '../../ui/styles';
import {
  CONVENTION_LABELS,
  INDEX_LABELS,
  INDEXES,
} from '../models/curve-terms';
import type { CurveSummary } from '../models/curve.types';
import { useCurveList, type CurveGroup } from './use-curve-list';

// Base UI keeps an empty value for the placeholder, so "all" needs its own.
const ALL = 'ALL';

const INDEX_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todos' },
  ...INDEXES.map((index) => ({ value: index, label: INDEX_LABELS[index] })),
];

function CurveRow({
  curve,
  search,
}: {
  readonly curve: CurveSummary;
  readonly search: string;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={{ pathname: curve.id, search }}
        className="group grid gap-1 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
      >
        <span className="flex items-start gap-3">
          <CurveIcon className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
          <span className="grid gap-1">
            <span className="font-medium text-accent group-hover:underline">
              {curve.name}
            </span>
            {curve.description && (
              <span className="line-clamp-2 text-sm text-muted">
                {curve.description}
              </span>
            )}
          </span>
        </span>
        <span className="pl-8 text-sm text-muted tabular-nums sm:pl-0 sm:text-right">
          {formatIsoDate(curve.coverage.startDate)} a{' '}
          {formatIsoDate(curve.coverage.endDate)}, mantida em diante
        </span>
      </Link>
    </li>
  );
}

function CurveGroupSection({
  group,
  search,
}: {
  readonly group: CurveGroup;
  readonly search: string;
}) {
  const id = `curves-${group.index}-${group.origin}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border bg-bg px-4 py-2 text-sm font-semibold tracking-wide text-muted uppercase"
      >
        <span>
          {INDEX_LABELS[group.index]} · {ORIGIN_LABELS[group.origin]}
        </span>
        <span className="font-normal tracking-normal normal-case">
          {CONVENTION_LABELS[group.index]}
        </span>
      </h2>
      <ul className="m-0 grid list-none p-0">
        {group.curves.map((curve) => (
          <CurveRow key={curve.id} curve={curve} search={search} />
        ))}
      </ul>
    </section>
  );
}

export function CurveListPage() {
  const list = useCurveList();
  const { state, correctedSearch, search } = list;

  if (correctedSearch !== null) {
    return <Navigate replace to={{ search: correctedSearch }} />;
  }

  return (
    <section aria-labelledby="curves-title" className="grid gap-6">
      <title>Curvas | InvestFlow</title>
      <PageLabel icon={CurveIcon}>Curvas</PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          id="curves-title"
          icon={CurveIcon}
          subtitle="As trajetórias de índices que suas simulações usam: as do sistema e as suas."
        >
          Curvas
        </PageTitle>
        <Link to={{ pathname: 'nova', search }} className={primaryButton}>
          <PlusIcon className="size-5 shrink-0" />
          Nova curva
        </Link>
      </header>

      <div role="search" aria-label="Filtrar curvas" className="max-w-xs">
        <FormField label="Índice">
          {(control) => (
            <SelectField
              {...control}
              value={list.index ?? ALL}
              placeholder="Todos"
              options={INDEX_OPTIONS}
              onValueChange={(value) =>
                list.setIndex(value === ALL ? null : (value as EconomicIndex))
              }
            />
          )}
        </FormField>
      </div>

      <div
        className={`${surface} overflow-hidden`}
        aria-busy={
          state.status === 'loading' ||
          (state.status === 'ready' && state.updating)
        }
      >
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando curvas…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar as curvas.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={list.retry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.groups.length === 0 && (
          <EmptyState
            icon={CurveIcon}
            actions={
              <Link
                to={{ pathname: 'nova', search }}
                className={secondaryButton}
              >
                <PlusIcon className="size-4 shrink-0" />
                Cadastrar curva
              </Link>
            }
          >
            <p className="m-0">
              {list.index
                ? `Ainda não há curvas de ${INDEX_LABELS[list.index]}.`
                : 'Ainda não há curvas. Cadastre os valores de um índice para usá-los nas simulações.'}
            </p>
          </EmptyState>
        )}
        {state.status === 'ready' && state.groups.length > 0 && (
          // Replays when another filter arrives.
          <div key={search} className="motion-safe:animate-fade-in">
            {state.groups.map((group) => (
              <CurveGroupSection
                key={`${group.index}-${group.origin}`}
                group={group}
                search={search}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
