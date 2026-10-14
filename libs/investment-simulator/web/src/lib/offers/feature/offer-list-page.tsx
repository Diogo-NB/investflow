import { Link, Navigate } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { FormField } from '../../ui/form-field';
import { EmptyState } from '../../ui/empty-state';
import { OfferIcon, PlusIcon, SearchIcon } from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { PaginationNav } from '../../ui/pagination-nav';
import { SelectField, type SelectOption } from '../../ui/select-field';
import {
  bareInput,
  fieldBox,
  primaryButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import {
  REDEMPTION_LABELS,
  remunerationLabel,
  type TitleType,
} from '../models/offer-terms';
import type { ContentOrigin, OfferSummary } from '../models/offer.types';
import { ORIGIN_LABELS } from '../utils/offer-groups';
import { useOfferList, type OfferGroup } from './use-offer-list';

// Base UI keeps an empty value for the placeholder, so "all" needs its own.
const ALL = 'ALL';

const ORIGIN_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todas' },
  ...(['SYSTEM', 'OWN'] as const).map((origin) => ({
    value: origin,
    label: ORIGIN_LABELS[origin],
  })),
];

const TITLE_TYPE_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todos' },
  ...(['CDB', 'LCI', 'LCA'] as const).map((type) => ({
    value: type,
    label: type,
  })),
];

function OfferRow({
  offer,
  search,
}: {
  readonly offer: OfferSummary;
  readonly search: string;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={{ pathname: offer.id, search }}
        className="group grid gap-1 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
      >
        <span className="flex items-start gap-3">
          <OfferIcon className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
          <span className="grid gap-1">
            <span className="font-medium text-accent group-hover:underline">
              {offer.name}
            </span>
            <span className="text-sm text-muted">
              {offer.issuerName ?? 'Sem emissor'}
            </span>
          </span>
        </span>
        <span className="pl-8 text-sm text-muted sm:pl-0 sm:text-right">
          {remunerationLabel(offer.remunerationTerms)} · vence em{' '}
          {formatIsoDate(offer.maturityDate)} · liquidez{' '}
          {REDEMPTION_LABELS[offer.redemptionTerms.kind].toLowerCase()}
        </span>
      </Link>
    </li>
  );
}

function OfferGroupSection({
  group,
  search,
}: {
  readonly group: OfferGroup;
  readonly search: string;
}) {
  const id = `offers-${group.titleType}-${group.origin}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="m-0 border-b border-border bg-bg px-4 py-2 text-sm font-semibold tracking-wide text-muted uppercase"
      >
        {group.titleType} · {ORIGIN_LABELS[group.origin]}
      </h2>
      <ul className="m-0 grid list-none p-0">
        {group.offers.map((offer) => (
          <OfferRow key={offer.id} offer={offer} search={search} />
        ))}
      </ul>
    </section>
  );
}

function OfferFilters({
  q,
  titleType,
  onSearch,
  onTitleType,
  origin,
  onOrigin,
}: {
  readonly q: string;
  readonly titleType: TitleType | undefined;
  readonly onSearch: (q: string) => void;
  readonly onTitleType: (titleType: TitleType | null) => void;
  readonly origin: ContentOrigin | undefined;
  readonly onOrigin: (origin: ContentOrigin | null) => void;
}) {
  return (
    <div
      role="search"
      aria-label="Filtrar ofertas"
      className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]"
    >
      <form
        // A new search remounts the field with the URL's value.
        key={q}
        className="flex items-end gap-2 sm:col-span-2 lg:col-span-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(String(new FormData(event.currentTarget).get('q') ?? ''));
        }}
      >
        <div className="flex-1">
          <FormField label="Buscar por nome ou emissor">
            {(control) => (
              <div className={fieldBox}>
                <SearchIcon className="ml-3 size-5 shrink-0 text-muted" />
                <input
                  {...control}
                  name="q"
                  type="search"
                  maxLength={100}
                  defaultValue={q}
                  className={bareInput}
                />
              </div>
            )}
          </FormField>
        </div>
        <button type="submit" className={secondaryButton}>
          <SearchIcon className="size-4 shrink-0" />
          Buscar
        </button>
      </form>
      <FormField label="Título">
        {(control) => (
          <SelectField
            {...control}
            value={titleType ?? ALL}
            placeholder="Todos"
            options={TITLE_TYPE_OPTIONS}
            onValueChange={(value) =>
              onTitleType(value === ALL ? null : (value as TitleType))
            }
          />
        )}
      </FormField>
      <FormField label="Origem">
        {(control) => (
          <SelectField
            {...control}
            value={origin ?? ALL}
            placeholder="Todas"
            options={ORIGIN_OPTIONS}
            onValueChange={(value) =>
              onOrigin(value === ALL ? null : (value as ContentOrigin))
            }
          />
        )}
      </FormField>
    </div>
  );
}

export function OfferListPage() {
  const list = useOfferList();
  const { page, state, correctedSearch, search } = list;

  if (correctedSearch !== null) {
    return <Navigate replace to={{ search: correctedSearch }} />;
  }

  return (
    <section aria-labelledby="offers-title" className="grid gap-6">
      <title>Ofertas | InvestFlow</title>
      <PageLabel icon={OfferIcon}>Ofertas</PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          id="offers-title"
          icon={OfferIcon}
          subtitle="Os títulos que suas simulações usam: os do sistema e os seus."
        >
          Ofertas
        </PageTitle>
        <Link to={{ pathname: 'nova', search }} className={primaryButton}>
          <PlusIcon className="size-5 shrink-0" />
          Nova oferta
        </Link>
      </header>

      <OfferFilters
        q={list.filters.q ?? ''}
        titleType={list.filters.titleType}
        onSearch={list.submitSearch}
        onTitleType={list.setTitleType}
        origin={list.filters.origin}
        onOrigin={list.setOrigin}
      />

      <div
        className={`${surface} overflow-hidden`}
        aria-busy={
          state.status === 'loading' ||
          (state.status === 'ready' && state.updating)
        }
      >
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando ofertas…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar as ofertas.</p>
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
            icon={OfferIcon}
            actions={
              <Link to="nova" className={secondaryButton}>
                <PlusIcon className="size-4 shrink-0" />
                Cadastrar oferta
              </Link>
            }
          >
            {list.filtered ? (
              <p className="m-0">Nenhuma oferta corresponde à busca.</p>
            ) : (
              <p className="m-0">
                Ainda não há ofertas. Cadastre os termos de um CDB, LCI ou LCA
                para usá-los nas simulações.
              </p>
            )}
          </EmptyState>
        )}
        {state.status === 'ready' && state.groups.length > 0 && (
          // Replays when another page or filter arrives.
          <div key={search} className="motion-safe:animate-fade-in">
            {state.groups.map((group) => (
              <OfferGroupSection
                key={`${group.titleType}-${group.origin}`}
                group={group}
                search={search}
              />
            ))}
          </div>
        )}
      </div>

      {state.status === 'ready' && (
        <PaginationNav
          label="Páginas de ofertas"
          page={page}
          lastPage={state.lastPage}
        />
      )}
    </section>
  );
}
