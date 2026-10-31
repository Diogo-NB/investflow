import { Dialog } from '@base-ui/react/dialog';
import { useRef } from 'react';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import {
  issuerAndNameLabel,
  offerTermsLabel,
} from '../../offers/models/offer-terms';
import { SimulationListFilterBar } from '../../simulations/feature/simulation-list-filters';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SpinningRefreshIcon,
  XIcon,
} from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { primaryButton, quietButton, secondaryButton } from '../../ui/styles';
import { useAddInvestmentPlanSimulations } from './use-add-investment-plan-simulations';

type Picker = ReturnType<typeof useAddInvestmentPlanSimulations>;

function PickerRow({
  item,
  picker,
}: {
  readonly item: SimulationListItem;
  readonly picker: Picker;
}) {
  const member = picker.isMember(item.id);
  const chosen = member || picker.chosen.includes(item.id);
  return (
    <li className="border-b border-border last:border-b-0">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 px-2 py-3 hover:bg-accent-soft has-disabled:cursor-default has-disabled:hover:bg-transparent">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 cursor-[inherit] accent-accent"
          checked={chosen}
          disabled={
            member || picker.pending || (!chosen && !picker.canChooseMore)
          }
          onChange={() => picker.toggle(item.id)}
        />
        <span className="grid min-w-0 gap-0.5">
          <span className="font-medium wrap-break-word">
            {offerTermsLabel(item)}
            {member && (
              <span className="font-normal text-muted"> · já no plano</span>
            )}
          </span>
          <span className="text-sm text-muted">
            {issuerAndNameLabel({ ...item, name: item.offerName })} ·{' '}
            {item.offerScope === 'SIMULATION' && 'Termos próprios · '}
            {formatMoney(item.principal)} ·{' '}
            <span className="whitespace-nowrap tabular-nums">
              {formatIsoDate(item.investmentDate)} a{' '}
              {formatIsoDate(item.maturityDate)}
            </span>
          </span>
        </span>
      </label>
    </li>
  );
}

function PickerBody({
  picker,
  onClearFilters,
}: {
  readonly picker: Picker;
  readonly onClearFilters: () => void;
}) {
  const { state } = picker;
  if (state.status === 'loading') {
    return <ListSkeleton label="Carregando simulações…" />;
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="grid justify-items-start gap-4">
        <p className="m-0">Não foi possível carregar suas simulações.</p>
        <button
          type="button"
          className={secondaryButton}
          disabled={state.retrying}
          onClick={picker.retry}
        >
          {state.retrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      </div>
    );
  }
  if (state.total === 0 && picker.filtered) {
    return (
      <div className="grid justify-items-start gap-4">
        <p className="m-0 text-muted">
          Nenhuma simulação corresponde aos filtros.
        </p>
        <button
          type="button"
          className={secondaryButton}
          onClick={onClearFilters}
        >
          <XIcon className="size-4 shrink-0" />
          Limpar filtros
        </button>
      </div>
    );
  }
  if (state.total === 0) {
    return <p className="m-0 text-muted">Você ainda não tem simulações.</p>;
  }
  return (
    <div className="grid gap-3">
      <ul
        aria-busy={state.updating}
        className={`m-0 grid list-none p-0 transition-opacity duration-150 ${state.updating ? 'opacity-50' : ''}`}
      >
        {state.items.map((item) => (
          <PickerRow key={item.id} item={item} picker={picker} />
        ))}
      </ul>
      {state.lastPage > 1 && (
        <nav
          aria-label="Páginas de simulações"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            className={`${quietButton} gap-1`}
            disabled={picker.page === 1}
            onClick={() => picker.setPage(picker.page - 1)}
          >
            <ChevronLeftIcon className="size-4 shrink-0" />
            Anterior
          </button>
          <span className="px-2 text-sm text-muted" aria-live="polite">
            Página {picker.page} de {state.lastPage}
          </span>
          <button
            type="button"
            className={`${quietButton} gap-1`}
            disabled={picker.page === state.lastPage}
            onClick={() => picker.setPage(picker.page + 1)}
          >
            Próxima
            <ChevronRightIcon className="size-4 shrink-0" />
          </button>
        </nav>
      )}
    </div>
  );
}

// Mounted only while open, so each opening starts with nothing chosen. It
// stays open while the add is pending.
export function AddInvestmentPlanSimulationsDialog({
  investmentPlanId,
  memberIds,
  availableSlots,
  onClose,
}: {
  readonly investmentPlanId: string;
  readonly memberIds: readonly string[];
  readonly availableSlots: number;
  readonly onClose: () => void;
}) {
  const picker = useAddInvestmentPlanSimulations({
    investmentPlanId,
    memberIds,
    availableSlots,
    onAdded: onClose,
  });
  const count = picker.chosen.length;
  const listRef = useRef<HTMLDivElement>(null);

  // The button pressed is disabled or removed once the filters are cleared.
  function clearFilters() {
    picker.clearFilters();
    listRef.current?.focus();
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !picker.pending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-fg opacity-30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 grid max-h-[calc(100dvh-2rem)] w-xl max-w-[calc(100vw-2rem)] -translate-1/2 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 rounded-surface border border-border bg-surface p-6 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Dialog.Title className="m-0 text-lg font-semibold">
            Adicionar simulações
          </Dialog.Title>
          <Dialog.Description className="m-0 text-muted">
            Suas simulações.{' '}
            {availableSlots === 1
              ? 'Cabe mais 1 neste plano.'
              : `Cabem mais ${availableSlots} neste plano.`}
          </Dialog.Description>
          {/* The open filters scroll with the list so the actions stay in
              view on short screens. */}
          <div className="grid min-h-0 content-start gap-4 overflow-y-auto">
            <SimulationListFilterBar
              filters={picker.filters}
              sort={picker.sort}
              onChange={picker.setFilter}
              onSortChange={picker.setSort}
              onClear={clearFilters}
            />
            <div
              ref={listRef}
              tabIndex={-1}
              role="region"
              aria-label="Simulações"
              className="outline-none"
            >
              <PickerBody picker={picker} onClearFilters={clearFilters} />
            </div>
          </div>
          <div className="grid gap-3">
            <p aria-live="polite" className="m-0 text-sm text-muted">
              {count === 0
                ? 'Nenhuma escolhida.'
                : `${count} ${count === 1 ? 'escolhida' : 'escolhidas'}${picker.canChooseMore ? '' : ' · o plano ficará cheio'}.`}
            </p>
            {picker.problem && (
              <p role="alert" className="m-0 text-sm text-error">
                {picker.problem}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Dialog.Close
                className={secondaryButton}
                disabled={picker.pending}
              >
                Cancelar
              </Dialog.Close>
              <button
                type="button"
                className={primaryButton}
                disabled={count === 0 || picker.pending}
                onClick={picker.submit}
              >
                {picker.pending ? (
                  <SpinningRefreshIcon className="size-5" />
                ) : (
                  <PlusIcon className="size-5 shrink-0" />
                )}
                {picker.pending ? 'Adicionando…' : 'Adicionar ao plano'}
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
