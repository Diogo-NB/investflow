import { Link, Navigate } from 'react-router';
import { EmptyState } from '../../ui/empty-state';
import { InvestmentPlanIcon, PlusIcon } from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { PaginationNav } from '../../ui/pagination-nav';
import { primaryButton, secondaryButton, surface } from '../../ui/styles';
import type { InvestmentPlanListItem } from '../models/investment-plan.types';
import { InvestmentPlanStatusTags } from '../ui/investment-plan-status-tags';
import { useInvestmentPlanList } from './use-investment-plan-list';

function simulationCountLabel(count: number): string {
  if (count === 0) return 'Nenhuma simulação';
  return count === 1 ? '1 simulação' : `${count} simulações`;
}

function InvestmentPlanRow({
  plan,
}: {
  readonly plan: InvestmentPlanListItem;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={plan.id}
        className="group grid gap-2 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"
      >
        <span className="flex min-w-0 items-start gap-3">
          <InvestmentPlanIcon className="mt-0.5 size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
          <span className="grid min-w-0 gap-1">
            <span className="font-medium wrap-break-word text-accent group-hover:underline">
              {plan.name}
            </span>
            {plan.description && (
              <span className="line-clamp-2 text-sm wrap-break-word text-muted">
                {plan.description}
              </span>
            )}
          </span>
        </span>
        <span className="grid gap-2 pl-8 sm:justify-items-end sm:pl-0">
          <span className="text-sm text-muted">
            {simulationCountLabel(plan.simulationCount)}
          </span>
          <InvestmentPlanStatusTags status={plan.status} />
        </span>
      </Link>
    </li>
  );
}

export function InvestmentPlanListPage() {
  const list = useInvestmentPlanList();
  const { state, page, correctedSearch } = list;

  if (correctedSearch !== null) {
    return <Navigate replace to={{ search: correctedSearch }} />;
  }

  return (
    <section aria-labelledby="investment-plans-title" className="grid gap-6">
      <title>Planos | InvestFlow</title>
      <PageLabel icon={InvestmentPlanIcon}>Planos</PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          id="investment-plans-title"
          icon={InvestmentPlanIcon}
          subtitle="As simulações em que você investiria junto."
        >
          Planos de investimento
        </PageTitle>
        <Link to="novo" className={primaryButton}>
          <PlusIcon className="size-5 shrink-0" />
          Novo plano
        </Link>
      </header>

      <div
        className={`${surface} overflow-hidden`}
        aria-busy={
          state.status === 'loading' ||
          (state.status === 'ready' && state.updating)
        }
      >
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando planos…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar seus planos.</p>
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
        {state.status === 'ready' && state.items.length === 0 && (
          <EmptyState
            icon={InvestmentPlanIcon}
            actions={
              <Link to="novo" className={secondaryButton}>
                <PlusIcon className="size-4 shrink-0" />
                Criar o primeiro plano
              </Link>
            }
          >
            <p className="m-0">
              Um plano reúne as simulações em que você investiria ao mesmo
              tempo, como a reserva de emergência ou a aposentadoria. Para
              comparar alternativas entre si, use a comparação de simulações.
            </p>
          </EmptyState>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <ul
            className={`m-0 grid list-none p-0 transition-opacity duration-150 motion-safe:animate-fade-in ${state.updating ? 'opacity-50' : ''}`}
          >
            {state.items.map((plan) => (
              <InvestmentPlanRow key={plan.id} plan={plan} />
            ))}
          </ul>
        )}
      </div>

      {state.status === 'ready' && (
        <PaginationNav
          label="Páginas de planos"
          page={page}
          lastPage={state.lastPage}
        />
      )}
    </section>
  );
}
