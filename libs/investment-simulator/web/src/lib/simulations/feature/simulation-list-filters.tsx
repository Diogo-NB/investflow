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
  OfferIcon,
  XIcon,
  type IconComponent,
} from '../../ui/icons';
import { quietButton } from '../../ui/styles';
import { simulationOptionsQuery } from '../api/simulation-api';
import type {
  CalculationStatus,
  CurveOption,
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

const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'Todos' },
  ...(Object.keys(STATUS_LABELS) as CalculationStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
];

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
  allLabel,
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
          placeholder={allLabel ?? 'Todas'}
          disabled={disabled}
          options={[
            ...(groups ? [{ value: ALL, label: allLabel ?? 'Todas' }] : []),
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
  filtered,
  onChange,
  onClear,
}: {
  readonly filters: SimulationListFilters;
  readonly filtered: boolean;
  readonly onChange: (name: SimulationListFilter, value: string | null) => void;
  readonly onClear: () => void;
}) {
  const fetchFn = useApiFetch();
  // Already cached when the user came from a simulation.
  const options = useQuery(simulationOptionsQuery(fetchFn));

  return (
    <div role="search" aria-label="Filtrar simulações">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <FilterSelect
          label="Oferta"
          icon={OfferIcon}
          value={filters.offerId}
          groups={
            options.data
              ? withUnlisted(
                  offerSelectGroups(options.data.offers),
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
          allLabel="Todos"
          options={STATUS_OPTIONS}
          onChange={(value) => onChange('calculationStatus', value)}
        />
        <button
          type="button"
          className={`${quietButton} gap-1`}
          disabled={!filtered}
          onClick={onClear}
        >
          <XIcon className="size-4 shrink-0" />
          Limpar filtros
        </button>
      </div>
      {options.isError && (
        <p className="mt-2 mb-0 text-sm text-muted">
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
