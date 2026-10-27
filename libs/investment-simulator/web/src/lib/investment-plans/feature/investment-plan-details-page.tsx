import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import { SimulationSortField } from '../../simulations/feature/simulation-list-filters';
import {
  ComparisonBar,
  SimulationRows,
  SimulationTable,
} from '../../simulations/feature/simulation-table';
import { EmptyState } from '../../ui/empty-state';
import {
  InvestmentPlanIcon,
  PencilIcon,
  PlusIcon,
  SimulationIcon,
  SpinningRefreshIcon,
  TrashIcon,
  XIcon,
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
import type { InvestmentPlanDetail } from '../models/investment-plan.types';
import { InvestmentPlanStatusTags } from '../ui/investment-plan-status-tags';
import { useInvestmentPlanDetails } from './use-investment-plan-details';

const ConfirmDialog = lazy(() =>
  import('../../ui/confirm-dialog').then((module) => ({
    default: module.ConfirmDialog,
  })),
);

const AddSimulationsDialog = lazy(() =>
  import('./add-investment-plan-simulations-dialog').then((module) => ({
    default: module.AddInvestmentPlanSimulationsDialog,
  })),
);

type Details = ReturnType<typeof useInvestmentPlanDetails>;

function deletionNotice(count: number): string {
  if (count === 0) return 'O plano não tem simulações.';
  return count === 1
    ? 'A simulação continua em Simulações.'
    : `As ${count} simulações continuam em Simulações.`;
}

function RemoveMemberButton({
  item,
  details,
}: {
  readonly item: SimulationListItem;
  readonly details: Details;
}) {
  const { removingId } = details.removeMember;
  const removing = removingId === item.id;
  return (
    <button
      type="button"
      title="Remover do plano"
      aria-label={`${removing ? 'Removendo' : 'Remover'} ${item.offerName} do plano`}
      className={`${quietButton} min-w-11 px-0 text-muted hover:text-error`}
      disabled={removingId !== null}
      onClick={() => details.removeMember.run(item.id)}
    >
      {removing ? (
        <SpinningRefreshIcon className="size-5" />
      ) : (
        <XIcon className="size-5 shrink-0" />
      )}
    </button>
  );
}

function MemberActions({
  plan,
  membersLoaded,
  onAdd,
}: {
  readonly plan: InvestmentPlanDetail;
  // The picker marks the current members, so it waits for them.
  readonly membersLoaded: boolean;
  readonly onAdd: () => void;
}) {
  const full = plan.availableSimulationSlots === 0;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={full || !membersLoaded}
          aria-describedby={full ? 'investment-plan-full' : undefined}
          onClick={onAdd}
        >
          <PlusIcon className="size-4 shrink-0" />
          Adicionar simulações
        </button>
        {full ? (
          <button
            type="button"
            className={quietButton}
            disabled
            aria-describedby="investment-plan-full"
          >
            Nova simulação
          </button>
        ) : (
          <Link
            to={`/simulacoes/nova?plano=${plan.id}`}
            className={quietButton}
          >
            Nova simulação
          </Link>
        )}
      </div>
      {full && (
        <p id="investment-plan-full" className="m-0 text-sm text-muted">
          O plano está cheio: {plan.simulationCount} simulações, o máximo.
          Remova uma para incluir outra.
        </p>
      )}
    </div>
  );
}

function Members({
  plan,
  details,
  onAdd,
}: {
  readonly plan: InvestmentPlanDetail;
  readonly details: Details;
  readonly onAdd: () => void;
}) {
  const { state } = details.members;
  const selection = {
    selected: details.selection.selected,
    canSelectMore: details.selection.canSelectMore,
    onToggle: details.selection.toggle,
  };
  const rowAction = (item: SimulationListItem) => (
    <RemoveMemberButton item={item} details={details} />
  );
  const failed =
    state.status === 'ready'
      ? state.items.find(({ id }) => id === details.removeMember.failedId)
      : undefined;
  return (
    <section
      aria-labelledby="investment-plan-members-title"
      className="grid gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2
          id="investment-plan-members-title"
          className="m-0 flex items-center gap-2 text-lg font-semibold"
        >
          <SimulationIcon className="size-5 shrink-0 text-accent" />
          Simulações do plano
        </h2>
        {plan.simulationCount > 1 && (
          <div className="w-full sm:w-72">
            <SimulationSortField
              sort={details.sort}
              onSortChange={details.setSort}
            />
          </div>
        )}
      </div>
      <MemberActions
        plan={plan}
        membersLoaded={state.status === 'ready'}
        onAdd={onAdd}
      />
      {failed && (
        <p role="alert" className="m-0 text-sm text-error">
          Não foi possível remover {failed.offerName} do plano. Tente novamente.
        </p>
      )}
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
            <p className="m-0">Não foi possível carregar as simulações.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={details.members.retry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.items.length === 0 && (
          <EmptyState icon={SimulationIcon}>
            <p className="m-0 text-muted">
              Este plano ainda não tem simulações. Adicione as que você
              investiria junto.
            </p>
          </EmptyState>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <div
            className={`transition-opacity duration-150 motion-safe:animate-fade-in ${state.updating ? 'opacity-50' : ''}`}
          >
            <SimulationTable
              caption={`Simulações do plano ${plan.name}`}
              items={state.items}
              search=""
              selection={selection}
              rowAction={rowAction}
            />
            <SimulationRows
              items={state.items}
              search=""
              selection={selection}
              rowAction={rowAction}
            />
          </div>
        )}
      </div>
      <ComparisonBar
        selected={details.selection.selected}
        comparisonPath={details.selection.comparisonPath}
        onClear={details.selection.clear}
      />
    </section>
  );
}

export function InvestmentPlanDetailsPage() {
  const { investmentPlanId = '' } = useParams();
  const details = useInvestmentPlanDetails(investmentPlanId);
  const { state, remove } = details;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  if (details.correctedSearch !== null) {
    return <Navigate replace to={{ search: details.correctedSearch }} />;
  }

  return (
    <section aria-labelledby="investment-plan-title" className="grid gap-6">
      <title>
        {state.status === 'ready'
          ? `${state.plan.name} | InvestFlow`
          : 'Plano | InvestFlow'}
      </title>
      <PageLabel icon={InvestmentPlanIcon}>
        <Link to="/planos" className="text-accent">
          Planos
        </Link>
      </PageLabel>
      {state.status === 'loading' && (
        <div className={surface}>
          <ListSkeleton label="Carregando plano…" />
          <span id="investment-plan-title" hidden>
            Plano
          </span>
        </div>
      )}
      {state.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="investment-plan-title" className="m-0 text-xl font-semibold">
            Plano não encontrado
          </h1>
          <p className="m-0 text-muted">
            Ele pode ter sido excluído. Suas simulações continuam em Simulações.
          </p>
          <Link to="/planos" className={secondaryButton}>
            Ver planos
          </Link>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="investment-plan-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir o plano
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
              id="investment-plan-title"
              icon={InvestmentPlanIcon}
              subtitle={state.plan.description ?? undefined}
            >
              <span className="wrap-break-word">{state.plan.name}</span>
            </PageTitle>
            <div className="flex flex-wrap gap-2">
              <Link to="editar" className={primaryButton}>
                <PencilIcon className="size-4 shrink-0" />
                Editar
              </Link>
              <button
                type="button"
                className={`${quietButton} gap-2 text-error`}
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon className="size-4 shrink-0" />
                Excluir
              </button>
            </div>
          </header>
          <div aria-live="polite">
            <InvestmentPlanStatusTags status={state.plan.status} />
          </div>
          <Members
            plan={state.plan}
            details={details}
            onAdd={() => setAdding(true)}
          />
          {adding && (
            <Suspense fallback={null}>
              <AddSimulationsDialog
                investmentPlanId={state.plan.id}
                memberIds={details.members.ids}
                availableSlots={state.plan.availableSimulationSlots}
                onClose={() => setAdding(false)}
              />
            </Suspense>
          )}
          {confirmingDelete && (
            <Suspense fallback={null}>
              <ConfirmDialog
                open
                onOpenChange={setConfirmingDelete}
                title="Excluir este plano?"
                description={`A exclusão é definitiva. ${deletionNotice(state.plan.simulationCount)}`}
                cancelLabel="Cancelar"
                confirmLabel={remove.pending ? 'Excluindo…' : 'Excluir plano'}
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
        </>
      )}
    </section>
  );
}
