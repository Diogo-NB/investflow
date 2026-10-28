import { Popover } from '@base-ui/react/popover';
import { Link } from 'react-router';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InvestmentPlanIcon,
  PlusIcon,
  SpinningRefreshIcon,
} from '../../ui/icons';
import { quietButton, secondaryButton } from '../../ui/styles';
import type { InvestmentPlanListItem } from '../models/investment-plan.types';
import {
  useSimulationInvestmentPlanPicker,
  type SimulationInvestmentPlansState,
} from './use-simulation-investment-plans';

type Picker = ReturnType<typeof useSimulationInvestmentPlanPicker>;

function PickerRow({
  plan,
  picker,
}: {
  readonly plan: InvestmentPlanListItem;
  readonly picker: Picker;
}) {
  const reason = picker.isMember(plan)
    ? 'Já inclui esta simulação'
    : picker.isFull(plan)
      ? 'Plano cheio: 50 simulações'
      : null;
  const pending = picker.pendingPlanId === plan.id;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium wrap-break-word">{plan.name}</span>
        <span className="text-sm text-muted">
          {reason ??
            (plan.simulationCount === 1
              ? '1 simulação'
              : `${plan.simulationCount} simulações`)}
        </span>
      </span>
      <button
        type="button"
        className={`${quietButton} shrink-0 gap-2 disabled:opacity-50`}
        disabled={reason !== null || picker.pendingPlanId !== null}
        aria-label={`Adicionar ao plano ${plan.name}`}
        onClick={() => picker.add(plan)}
      >
        {pending ? (
          <SpinningRefreshIcon className="size-4" />
        ) : (
          <PlusIcon className="size-4 shrink-0" />
        )}
        {pending ? 'Adicionando…' : 'Adicionar'}
      </button>
    </li>
  );
}

function PickerBody({ picker }: { readonly picker: Picker }) {
  const { state } = picker;
  if (state.status === 'loading') {
    return (
      <p role="status" className="m-0 text-muted">
        Carregando planos…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="grid justify-items-start gap-3">
        <p className="m-0">Não foi possível carregar seus planos.</p>
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
  if (state.total === 0) {
    return (
      <p className="m-0 text-muted">
        Você ainda não tem planos.{' '}
        <Link to="/planos/novo" className="text-accent">
          Criar um plano
        </Link>
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <ul
        aria-busy={state.updating}
        className={`m-0 grid list-none p-0 transition-opacity duration-150 ${state.updating ? 'opacity-50' : ''}`}
      >
        {state.items.map((plan) => (
          <PickerRow key={plan.id} plan={plan} picker={picker} />
        ))}
      </ul>
      {state.lastPage > 1 && (
        <nav
          aria-label="Páginas de planos"
          className="flex flex-wrap items-center gap-1"
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

// Mounted only while the popover is open, so each opening starts on the
// first page with no earlier result shown.
function InvestmentPlanPicker({
  simulationId,
  memberIds,
}: {
  readonly simulationId: string;
  readonly memberIds: readonly string[];
}) {
  const picker = useSimulationInvestmentPlanPicker({ simulationId, memberIds });
  return (
    <div className="grid gap-3">
      <Popover.Title className="m-0 text-base font-semibold">
        Adicionar ao plano
      </Popover.Title>
      <div className="max-h-80 min-h-0 overflow-y-auto">
        <PickerBody picker={picker} />
      </div>
      <p aria-live="polite" className="m-0 text-sm empty:hidden">
        {picker.problem ? (
          <span className="text-error">{picker.problem}</span>
        ) : picker.addedPlan ? (
          <span className="text-success">
            Adicionada ao plano {picker.addedPlan.name}.
          </span>
        ) : null}
      </p>
    </div>
  );
}

function PlanLinks({
  state,
}: {
  readonly state: Extract<SimulationInvestmentPlansState, { status: 'ready' }>;
}) {
  if (state.total === 0) return <span className="text-muted">nenhum</span>;
  const unnamed = state.total - state.items.length;
  return (
    <>
      {state.items.map((plan, index) => (
        <span key={plan.id}>
          <Link to={`/planos/${plan.id}`} className="text-accent">
            {plan.name}
          </Link>
          {index < state.items.length - 1 && ', '}
        </span>
      ))}
      {unnamed > 0 && <span className="text-muted"> e mais {unnamed}</span>}
    </>
  );
}

/** The workspace's "Planos" line: where the simulation is, and adding it. */
export function SimulationInvestmentPlans({
  simulationId,
  state,
  onRetry,
}: {
  readonly simulationId: string;
  readonly state: SimulationInvestmentPlansState;
  readonly onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="m-0 flex min-w-0 flex-wrap items-center gap-1">
        <InvestmentPlanIcon className="mr-1 size-5 shrink-0 text-muted" />
        <span className="text-muted">Planos:</span>
        {state.status === 'ready' ? (
          <PlanLinks state={state} />
        ) : state.status === 'error' ? (
          <span role="alert">
            não foi possível carregar.{' '}
            <button
              type="button"
              className="min-h-11 cursor-pointer text-accent underline disabled:cursor-default disabled:text-muted"
              disabled={state.retrying}
              onClick={onRetry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </span>
        ) : (
          <span role="status" className="text-muted">
            carregando…
          </span>
        )}
      </p>
      <Popover.Root>
        <Popover.Trigger
          className={`${quietButton} gap-2`}
          disabled={state.status !== 'ready'}
        >
          <PlusIcon className="size-4 shrink-0" />
          Adicionar ao plano
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            sideOffset={8}
            align="start"
            collisionPadding={16}
            className="z-20"
          >
            <Popover.Popup className="w-96 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-surface border border-border bg-surface p-4 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <InvestmentPlanPicker
                simulationId={simulationId}
                memberIds={
                  state.status === 'ready'
                    ? state.items.map((plan) => plan.id)
                    : []
                }
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
