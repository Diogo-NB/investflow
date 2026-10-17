import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  REMUNERATION_LABELS,
  type RemunerationKind,
} from '../../offers/models/offer-terms';
import {
  offerSelectGroups,
  ORIGIN_LABELS,
} from '../../offers/utils/offer-groups';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { FormField } from '../../ui/form-field';
import {
  SelectField,
  type SelectGroup,
  type SelectOption,
} from '../../ui/select-field';
import {
  CurveIcon,
  FilterIcon,
  OfferIcon,
  XIcon,
  type IconComponent,
} from '../../ui/icons';
import { quietButton, secondaryButton } from '../../ui/styles';
import { simulationOptionsQuery } from '../api/simulation-api';
import type {
  CalculationStatus,
  CurveOption,
  OfferOption,
  SimulationOptions,
} from '../models/simulation.types';
import type {
  SimulationListFilter,
  SimulationListFilters,
} from '../utils/simulation-list-search';

// Base UI keeps an empty value for the placeholder, so "all" needs its own.
const ALL = 'ALL';

const TITLE_TYPE_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todos' },
  ...(['CDB', 'LCI', 'LCA'] as const).map((type) => ({
    value: type,
    label: type,
  })),
];

const KIND_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todas' },
  ...(
    [
      'PREFIXED',
      'CDI_PERCENTAGE',
      'SELIC_PERCENTAGE',
      'IPCA_PLUS',
    ] as const satisfies readonly RemunerationKind[]
  ).map((kind) => ({ value: kind, label: REMUNERATION_LABELS[kind] })),
];

const STATUS_LABELS: Record<CalculationStatus, string> = {
  CALCULATED: 'Calculada',
  PENDING: 'Calculando',
  INVALID: 'Requer ação',
  FAILED: 'Falha técnica',
};

// Rows of a calculated simulation whose premises changed read "Desatualizado".
const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todas' },
  ...(Object.keys(STATUS_LABELS) as CalculationStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
    detail:
      status === 'CALCULATED' ? 'Inclui resultados desatualizados' : undefined,
  })),
];

// An offer that cannot be calculated yet may still have simulations, so the
// filter keeps it selectable.
function offerGroups(offers: readonly OfferOption[]): SelectGroup[] {
  return offerSelectGroups(
    offers.map((offer) => ({ ...offer, unsupportedReason: null })),
  );
}

// A filter from a link may name an offer or curve no longer listed.
function withUnlisted(
  groups: SelectGroup[],
  value: string | undefined,
  label: string,
): SelectGroup[] {
  const listed = groups.some((group) =>
    group.options.some((option) => option.value === value),
  );
  return value && !listed
    ? [{ label: 'Indisponível', options: [{ value, label }] }, ...groups]
    : groups;
}

// A curve is listed under each kind of its index, so it is kept once.
function curveGroups(options: SimulationOptions): SelectGroup[] {
  const curves = new Map<string, CurveOption>();
  for (const remuneration of options.remunerations) {
    for (const curve of remuneration.curves) curves.set(curve.id, curve);
  }
  return (['SYSTEM', 'OWN'] as const)
    .map((origin) => ({
      label: ORIGIN_LABELS[origin],
      options: [...curves.values()]
        .filter((curve) => curve.origin === origin)
        .map((curve) => ({ value: curve.id, label: curve.name })),
    }))
    .filter((group) => group.options.length > 0);
}

function FilterSelect({
  label,
  icon,
  value,
  allLabel = 'Todas',
  options,
  groups,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly icon?: IconComponent;
  readonly value: string | undefined;
  readonly allLabel?: string;
  readonly options?: readonly SelectOption[];
  readonly groups?: readonly SelectGroup[];
  readonly disabled?: boolean;
  readonly onChange: (value: string | null) => void;
}) {
  return (
    <FormField label={label} icon={icon}>
      {(control) => (
        <SelectField
          {...control}
          value={value ?? ALL}
          placeholder={allLabel}
          disabled={disabled}
          options={[
            ...(groups ? [{ value: ALL, label: allLabel }] : []),
            ...(options ?? []),
          ]}
          groups={groups ?? []}
          onValueChange={(next) => onChange(next === ALL ? null : next)}
        />
      )}
    </FormField>
  );
}

export function SimulationListFilterBar({
  filters,
  onChange,
  onClear,
}: {
  readonly filters: SimulationListFilters;
  readonly onChange: (name: SimulationListFilter, value: string | null) => void;
  readonly onClear: () => void;
}) {
  const fetchFn = useApiFetch();
  // Already cached when the user came from a simulation.
  const options = useQuery(simulationOptionsQuery(fetchFn));
  const panelId = useId();
  // Phones only: the stacked filters would push every row below the fold.
  const [expanded, setExpanded] = useState(false);
  const active = Object.keys(filters).length;

  return (
    <div role="search" aria-label="Filtrar simulações" className="grid gap-4">
      <button
        type="button"
        className={`${secondaryButton} justify-self-start sm:hidden`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(!expanded)}
      >
        <FilterIcon className="size-5 shrink-0" />
        {active > 0 ? `Filtros (${active})` : 'Filtros'}
        <span
          aria-hidden="true"
          className={`text-muted transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      <div
        id={panelId}
        className={`${expanded ? 'grid' : 'hidden'} items-end gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]`}
      >
        <FilterSelect
          label="Oferta"
          icon={OfferIcon}
          value={filters.offerId}
          groups={
            options.data
              ? withUnlisted(
                  offerGroups(options.data.offers),
                  filters.offerId,
                  'Oferta excluída',
                )
              : []
          }
          disabled={!options.data}
          onChange={(value) => onChange('offerId', value)}
        />
        <FilterSelect
          label="Curva"
          icon={CurveIcon}
          value={filters.curveId}
          groups={
            options.data
              ? withUnlisted(
                  curveGroups(options.data),
                  filters.curveId,
                  'Curva excluída',
                )
              : []
          }
          disabled={!options.data}
          onChange={(value) => onChange('curveId', value)}
        />
        <FilterSelect
          label="Título"
          value={filters.titleType}
          allLabel="Todos"
          options={TITLE_TYPE_OPTIONS}
          onChange={(value) => onChange('titleType', value)}
        />
        <FilterSelect
          label="Remuneração"
          value={filters.remunerationKind}
          options={KIND_OPTIONS}
          onChange={(value) => onChange('remunerationKind', value)}
        />
        <FilterSelect
          label="Situação"
          value={filters.calculationStatus}
          options={STATUS_OPTIONS}
          onChange={(value) => onChange('calculationStatus', value)}
        />
        <button
          type="button"
          className={`${quietButton} gap-1`}
          disabled={active === 0}
          onClick={onClear}
        >
          <XIcon className="size-4 shrink-0" />
          Limpar filtros
        </button>
      </div>
      {options.isError && (
        <p className="m-0 text-sm text-muted">
          Não foi possível carregar as ofertas e curvas para filtrar.{' '}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-accent underline"
            onClick={() => void options.refetch()}
          >
            Tentar novamente
          </button>
        </p>
      )}
    </div>
  );
}
