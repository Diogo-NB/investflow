import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { SimulationInvestmentPlans } from '../../investment-plans/feature/simulation-investment-plans';
import {
  useSimulationInvestmentPlans,
  type SimulationInvestmentPlansState,
} from '../../investment-plans/feature/use-simulation-investment-plans';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  CompareIcon,
  CopyIcon,
  PlusIcon,
  SimulationIcon,
  TrashIcon,
} from '../../ui/icons';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { quietButton, secondaryButton } from '../../ui/styles';
import type {
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';
import type { SimulationFormValues } from '../utils/simulation-form';
import {
  listSearch,
  listSearchSelecting,
} from '../utils/simulation-list-search';
import type { SaveProblem } from '../utils/simulation-save-problem';
import { CalculationPanel, type SavedCalculation } from './calculation-panel';
import { SimulationFormPanel } from './simulation-form-panel';
import {
  TEMPLATE_PARAM,
  type useSimulationCreation,
} from './use-simulation-creation';
import { useSimulationForm } from './use-simulation-form';
import type { useSimulationWorkspace } from './use-simulation-workspace';
import { useUnsavedChangesGuard } from '../../ui/use-unsaved-changes-guard';

type SimulationForm = ReturnType<typeof useSimulationForm>;
type Creation = ReturnType<typeof useSimulationCreation>['create'];
type Workspace = ReturnType<typeof useSimulationWorkspace>;

const ORIGIN_LABELS = { SYSTEM: 'Oferta do sistema', OWN: 'Minha oferta' };

const DELETION_NOTICE =
  'A simulação e o resultado deixam de aparecer. A oferta e a curva continuam disponíveis.';

function deletionNotice(plans: SimulationInvestmentPlansState): string {
  const count = plans.status === 'ready' ? plans.total : 0;
  const leaves =
    count === 0
      ? ''
      : count === 1
        ? ' Ela sai de 1 plano.'
        : ` Ela sai de ${count} planos.`;
  return `${DELETION_NOTICE}${leaves} Não é possível desfazer.`;
}

function SavedSimulationHeading({
  workspace,
}: {
  readonly workspace: SimulationWorkspace;
}) {
  const { offer, simulation } = workspace;
  return (
    <PageTitle
      id="simulation-title"
      icon={SimulationIcon}
      subtitle={
        <>
          {formatMoney(simulation.investment.principal)} de{' '}
          {formatIsoDate(simulation.investment.investmentDate)} a{' '}
          {formatIsoDate(offer.maturityDate)} ·{' '}
          {offer.deleted ? 'Oferta excluída' : ORIGIN_LABELS[offer.origin]}
        </>
      }
    >
      {[
        offer.name,
        `${offer.titleType} ${remunerationLabel(offer.remunerationTerms)}`,
      ].join(' · ')}
    </PageTitle>
  );
}

interface SimulationEditorLayoutProps {
  readonly documentTitle: string;
  readonly header: ReactNode;
  readonly form: SimulationForm;
  readonly options: SimulationOptions;
  readonly saved: SavedCalculation | null;
  readonly pending: boolean;
  readonly problem: SaveProblem | null;
  // Leaving is confirmed only while this holds.
  readonly guarding: boolean;
  readonly onSave: () => void;
  readonly children?: ReactNode;
}

function SimulationEditorLayout({
  documentTitle,
  header,
  form,
  options,
  saved,
  pending,
  problem,
  guarding,
  onSave,
  children,
}: SimulationEditorLayoutProps) {
  const [searchParams] = useSearchParams();
  const blocker = useUnsavedChangesGuard(guarding);
  const workspace = saved?.workspace ?? null;
  const { isDirty } = form.form.formState;
  const upToDate =
    !isDirty &&
    workspace?.calculation.status === 'CALCULATED' &&
    workspace.result !== null &&
    !workspace.result.outdated;

  return (
    <section aria-labelledby="simulation-title" className="grid gap-6">
      <title>{documentTitle}</title>
      <PageLabel icon={SimulationIcon}>
        <Link
          to={`/simulacoes${listSearch(searchParams)}`}
          className="text-accent"
        >
          Simulações
        </Link>
      </PageLabel>
      <header className="flex flex-wrap items-start justify-between gap-4">
        {header}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <SimulationFormPanel
          simulation={form}
          options={options}
          saved={workspace}
          pending={pending}
          upToDate={upToDate}
          onSave={onSave}
        />
        <CalculationPanel
          saved={saved}
          pending={pending}
          problem={problem}
          unsavedEdits={isDirty}
          taxRules={options.taxRules}
        />
      </div>

      {children}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Descartar alterações?"
        description="As alterações desta simulação ainda não foram salvas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar alterações"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </section>
  );
}

interface NewSimulationEditorProps {
  readonly initialValues: SimulationFormValues;
  readonly options: SimulationOptions;
  readonly create: Creation;
}

export function NewSimulationEditor({
  initialValues,
  options,
  create,
}: NewSimulationEditorProps) {
  const form = useSimulationForm({
    initialValues,
    offers: options.offers,
    remunerations: options.remunerations,
  });
  const submit = form.form.handleSubmit((values) =>
    create.run(values, form.showProblem),
  );

  return (
    <SimulationEditorLayout
      documentTitle="Nova simulação | InvestFlow"
      header={
        <PageTitle
          id="simulation-title"
          icon={SimulationIcon}
          subtitle="Escolha uma oferta e informe quanto e quando investir."
        >
          Nova simulação
        </PageTitle>
      }
      form={form}
      options={options}
      saved={null}
      pending={create.pending}
      problem={create.problem}
      guarding={form.form.formState.isDirty && !create.pending}
      onSave={() => void submit()}
    />
  );
}

interface SavedSimulationEditorProps {
  readonly workspace: SimulationWorkspace;
  readonly initialValues: SimulationFormValues;
  readonly options: SimulationOptions;
  readonly controls: Pick<Workspace, 'edit' | 'recalculate' | 'remove'>;
}

export function SavedSimulationEditor({
  workspace,
  initialValues,
  options,
  controls,
}: SavedSimulationEditorProps) {
  const { simulation } = workspace;
  const { edit, recalculate, remove } = controls;
  const form = useSimulationForm({
    initialValues,
    offers: options.offers,
    remunerations: options.remunerations,
  });
  const [searchParams] = useSearchParams();
  const investmentPlans = useSimulationInvestmentPlans(simulation.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The revision the form's values were saved at; the next edit sends it.
  const [baseRevision, setBaseRevision] = useState(simulation.revision);
  const changedElsewhere =
    !edit.pending && simulation.revision !== baseRevision;

  const submit = form.form.handleSubmit((values) =>
    edit.run(values, baseRevision, {
      onSaved: (savedValues, revision) => {
        form.form.reset(savedValues);
        setBaseRevision(revision);
      },
      onProblem: form.showProblem,
    }),
  );

  return (
    <SimulationEditorLayout
      documentTitle="Simulação | InvestFlow"
      header={
        <>
          <div className="grid min-w-0 gap-3">
            <SavedSimulationHeading workspace={workspace} />
            <SimulationInvestmentPlans
              simulationId={simulation.id}
              state={investmentPlans.state}
              onRetry={investmentPlans.retry}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/simulacoes/nova" className={secondaryButton}>
              <PlusIcon className="size-4 shrink-0" />
              Nova simulação
            </Link>
            <Link
              to={`/simulacoes/nova?${TEMPLATE_PARAM}=${simulation.id}`}
              className={secondaryButton}
            >
              <CopyIcon className="size-4 shrink-0" />
              Duplicar
            </Link>
            <Link
              to={`/simulacoes${listSearchSelecting(searchParams, simulation.id)}`}
              className={secondaryButton}
            >
              <CompareIcon className="size-4 shrink-0" />
              Comparar com…
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
        </>
      }
      form={form}
      options={options}
      saved={{
        workspace,
        changedElsewhere,
        retry: recalculate,
        onReload: () => void edit.reload(),
      }}
      pending={edit.pending}
      problem={edit.problem}
      guarding={form.form.formState.isDirty && !edit.pending && !remove.pending}
      onSave={() => void submit()}
    >
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir esta simulação?"
        description={deletionNotice(investmentPlans.state)}
        cancelLabel="Cancelar"
        confirmLabel={remove.pending ? 'Excluindo…' : 'Excluir simulação'}
        destructive
        pending={remove.pending}
        error={
          remove.failed
            ? 'Não foi possível excluir. Tente novamente.'
            : undefined
        }
        onConfirm={remove.run}
      />
    </SimulationEditorLayout>
  );
}
