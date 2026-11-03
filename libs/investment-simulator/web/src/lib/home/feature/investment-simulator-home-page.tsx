import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { formatReturnPercent } from '../../decimals/format-decimal';
import {
  issuerAndNameLabel,
  offerTermsLabel,
} from '../../offers/models/offer-terms';
import { InvestmentPlanRow } from '../../investment-plans/ui/investment-plan-row';
import type { SimulationListItem } from '../../simulations/models/simulation.types';
import {
  ComparisonBar,
  SimulationRows,
  SimulationTable,
  type Selection,
} from '../../simulations/feature/simulation-table';
import { CalculationStatusTag } from '../../simulations/ui/calculation-status-tag';
import { EmptyState } from '../../ui/empty-state';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CompareIcon,
  CurveIcon,
  InvestmentPlanIcon,
  OfferIcon,
  PlusIcon,
  SimulationIcon,
  StarIcon,
} from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import {
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import {
  useInvestmentSimulatorHome,
  type HomeReadState,
} from './use-investment-simulator-home';

const viewAllLink =
  'inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-medium text-accent no-underline hover:underline';

function ReadFailure({
  message,
  retrying,
  onRetry,
}: {
  readonly message: string;
  readonly retrying: boolean;
  readonly onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <p className="m-0">{message}</p>
      <button
        type="button"
        className={secondaryButton}
        disabled={retrying}
        onClick={onRetry}
      >
        {retrying ? 'Tentando…' : 'Tentar novamente'}
      </button>
    </div>
  );
}

function SectionHeader({
  id,
  icon: Icon,
  children,
  link,
}: {
  readonly id: string;
  readonly icon: typeof SimulationIcon;
  readonly children: ReactNode;
  readonly link?: { readonly to: string; readonly label: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2
        id={id}
        className="m-0 flex items-center gap-2 text-lg/tight font-semibold"
      >
        <Icon className="size-5 shrink-0 text-accent" />
        {children}
      </h2>
      {link && (
        <Link to={link.to} className={viewAllLink}>
          {link.label}
          <ArrowRightIcon className="size-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}

function ActionRequiredNotice({
  state,
  onRetry,
}: {
  readonly state: HomeReadState<number>;
  readonly onRetry: () => void;
}) {
  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <div className={surface}>
        <ReadFailure
          message="Não foi possível verificar as simulações que requerem ação."
          retrying={state.retrying}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (state.data === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-warning/40 bg-warning-soft px-4 py-3 motion-safe:animate-fade-in">
      <p className="m-0 flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold text-warning">
            {state.data === 1
              ? '1 simulação requer ação.'
              : `${state.data} simulações requerem ação.`}
          </strong>{' '}
          Revise as premissas para que voltem a ser calculadas.
        </span>
      </p>
      <Link
        to="/simulacoes?calculationStatus=INVALID"
        className={secondaryButton}
      >
        Revisar
        <ArrowRightIcon className="size-4 shrink-0" />
      </Link>
    </div>
  );
}

function BestResult({
  state,
  onRetry,
}: {
  readonly state: HomeReadState<SimulationListItem | null>;
  readonly onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <div
        aria-hidden="true"
        className={`${surface} h-24 motion-safe:animate-pulse`}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <div className={surface}>
        <ReadFailure
          message="Não foi possível carregar sua maior rentabilidade."
          retrying={state.retrying}
          onRetry={onRetry}
        />
      </div>
    );
  }
  const best = state.data;
  if (!best?.result) return null;
  return (
    <section
      aria-labelledby="home-best-title"
      className={`${surface} grid gap-3 p-4 motion-safe:animate-fade-in sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-6`}
    >
      <div className="grid min-w-0 gap-1">
        <h2
          id="home-best-title"
          className="m-0 flex items-center gap-2 text-sm font-medium text-muted"
        >
          <StarIcon className="size-4 shrink-0 text-accent" />
          Sua maior rentabilidade líquida
        </h2>
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl/tight font-semibold text-fg tabular-nums">
            {formatReturnPercent(best.result.netAnnualReturn)} a.a.
          </span>
          <Link
            to={`/simulacoes/${best.id}`}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {offerTermsLabel(best)}
          </Link>
        </p>
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted">
          {issuerAndNameLabel({ ...best, name: best.offerName })}
          {!best.isSettled && (
            <CalculationStatusTag status={best.calculationStatus} />
          )}
        </p>
      </div>
      <Link
        to="/simulacoes?sort=netAnnualReturn"
        className={`${viewAllLink} justify-self-start`}
      >
        Ver ranking
        <ArrowRightIcon className="size-4 shrink-0" />
      </Link>
    </section>
  );
}

function FirstSimulationGuide() {
  return (
    <EmptyState
      icon={SimulationIcon}
      actions={
        <Link to="/simulacoes/nova" className={primaryButton}>
          <PlusIcon className="size-5 shrink-0" />
          Criar a primeira simulação
        </Link>
      }
    >
      <p className="m-0 font-medium">Comece em três passos:</p>
      <ol className="mt-2 mb-0 grid list-decimal gap-1 pl-5 text-muted">
        <li>Escolha a oferta de um CDB, LCI ou LCA.</li>
        <li>Informe o valor e a data da aplicação.</li>
        <li>Veja o resultado líquido e compare com outras simulações.</li>
      </ol>
    </EmptyState>
  );
}

export function InvestmentSimulatorHomePage() {
  const home = useInvestmentSimulatorHome();
  const { recent, plans } = home;
  const selection: Selection = {
    selected: home.selected,
    canSelectMore: home.canSelectMore,
    onToggle: home.toggleSelected,
  };

  if (home.correctedSearch !== null) {
    return <Navigate replace to={{ search: home.correctedSearch }} />;
  }

  const hasNoSimulations = recent.status === 'ready' && recent.data.total === 0;

  return (
    <div className="grid gap-8">
      {/* Without simulations, the first-simulation guide holds the only
          creation action. */}
      {!hasNoSimulations && (
        <div className="flex flex-wrap gap-2">
          <Link to="/simulacoes/nova" className={primaryButton}>
            <PlusIcon className="size-5 shrink-0" />
            Nova simulação
          </Link>
          <Link to={home.simulationListPath} className={secondaryButton}>
            <CompareIcon className="size-5 shrink-0" />
            Comparar simulações
          </Link>
        </div>
      )}

      {!hasNoSimulations && (
        <>
          <ActionRequiredNotice
            state={home.actionRequiredCount}
            onRetry={home.retryActionRequired}
          />
          <BestResult state={home.best} onRetry={home.retryBest} />
        </>
      )}

      <section aria-labelledby="home-recent-title" className="grid gap-3">
        <SectionHeader
          id="home-recent-title"
          icon={SimulationIcon}
          link={
            hasNoSimulations
              ? undefined
              : { to: home.simulationListPath, label: 'Ver todas' }
          }
        >
          Simulações recentes
        </SectionHeader>
        <div className={surface} aria-busy={recent.status === 'loading'}>
          {recent.status === 'loading' && (
            <ListSkeleton label="Carregando simulações…" />
          )}
          {recent.status === 'error' && (
            <ReadFailure
              message="Não foi possível carregar suas simulações."
              retrying={recent.retrying}
              onRetry={home.retryRecent}
            />
          )}
          {hasNoSimulations && <FirstSimulationGuide />}
          {recent.status === 'ready' && recent.data.items.length > 0 && (
            <div className="motion-safe:animate-fade-in">
              <SimulationTable
                caption="Simulações recentes"
                items={recent.data.items}
                search=""
                selection={selection}
              />
              <SimulationRows
                items={recent.data.items}
                search=""
                selection={selection}
              />
            </div>
          )}
        </div>
        {recent.status === 'ready' && recent.data.items.length > 0 && (
          <p className="m-0 text-sm text-muted">
            Marque duas ou mais para comparar.
          </p>
        )}
      </section>

      <ComparisonBar
        selected={home.selected}
        comparisonPath={home.comparisonPath}
        onClear={home.clearSelection}
      />

      {!hasNoSimulations && (
        <section aria-labelledby="home-plans-title" className="grid gap-3">
          <SectionHeader
            id="home-plans-title"
            icon={InvestmentPlanIcon}
            link={
              plans.status === 'ready' && plans.data.total > 0
                ? { to: '/planos', label: 'Ver todos' }
                : undefined
            }
          >
            Planos
          </SectionHeader>
          <div
            className={`${surface} overflow-hidden`}
            aria-busy={plans.status === 'loading'}
          >
            {plans.status === 'loading' && (
              <ListSkeleton label="Carregando planos…" />
            )}
            {plans.status === 'error' && (
              <ReadFailure
                message="Não foi possível carregar seus planos."
                retrying={plans.retrying}
                onRetry={home.retryPlans}
              />
            )}
            {plans.status === 'ready' && plans.data.items.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="m-0 max-w-prose text-muted">
                  Reúna em um plano as simulações em que você investiria junto.
                </p>
                <Link to="/planos/novo" className={secondaryButton}>
                  <PlusIcon className="size-4 shrink-0" />
                  Criar plano
                </Link>
              </div>
            )}
            {plans.status === 'ready' && plans.data.items.length > 0 && (
              <ul className="m-0 grid list-none p-0 motion-safe:animate-fade-in">
                {plans.data.items.map((plan) => (
                  <InvestmentPlanRow key={plan.id} plan={plan} />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <nav
        aria-label="Premissas das simulações"
        className="grid gap-1 text-sm text-muted sm:flex sm:items-center sm:gap-2"
      >
        <span>Premissas das simulações:</span>
        <span className="-ml-3 flex flex-wrap">
          <Link to="/ofertas" className={`${quietButton} gap-2`}>
            <OfferIcon className="size-4 shrink-0" />
            Gerenciar ofertas
          </Link>
          <Link to="/curvas" className={`${quietButton} gap-2`}>
            <CurveIcon className="size-4 shrink-0" />
            Gerenciar curvas
          </Link>
        </span>
      </nav>
    </div>
  );
}
