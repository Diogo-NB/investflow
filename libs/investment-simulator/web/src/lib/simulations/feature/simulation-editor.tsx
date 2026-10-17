import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
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
import { CalculationPanel } from './calculation-panel';
import { SimulationFormPanel } from './simulation-form-panel';
import { useSimulationForm } from './use-simulation-form';
import {
  TEMPLATE_PARAM,
  type useSimulationWorkspace,
} from './use-simulation-workspace';
import { useUnsavedChangesGuard } from '../../ui/use-unsaved-changes-guard';

type Workspace = ReturnType<typeof useSimulationWorkspace>;

const ORIGIN_LABELS = { SYSTEM: 'Oferta do sistema', OWN: 'Minha oferta' };

interface SimulationEditorProps {
  readonly saved: SimulationWorkspace | null;
  readonly initialValues: SimulationFormValues;
  readonly options: SimulationOptions;
  readonly workspace: Workspace;
}

function SimulationHeading({
  saved,
}: {
  readonly saved: SimulationWorkspace | null;
}) {
  if (!saved) {
    return (
      <PageTitle
        id="simulation-title"
        icon={SimulationIcon}
        subtitle="Escolha uma oferta e informe quanto e quando investir."
      >
        Nova simulação
      </PageTitle>
    );
  }
  const { offer, simulation } = saved;
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

export function SimulationEditor({
  saved,
  initialValues,
  options,
  workspace,
}: SimulationEditorProps) {
  const simulation = saved?.simulation ?? null;
  const result = saved?.result ?? null;
  const form = useSimulationForm({
    initialValues,
    offers: options.offers,
    remunerations: options.remunerations,
  });
  const { save, remove } = workspace;
  const [searchParams] = useSearchParams();
  const { isDirty } = form.form.formState;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The revision the form's values were saved at; the next edit sends it.
  const [baseRevision, setBaseRevision] = useState(simulation?.revision ?? 0);
  const changedElsewhere =
    simulation !== null &&
    !save.pending &&
    simulation.revision !== baseRevision;

  const blocker = useUnsavedChangesGuard(
    isDirty && !save.pending && !remove.pending,
  );

  const upToDate =
    !isDirty &&
    saved?.calculation.status === 'CALCULATED' &&
    result !== null &&
    !result.outdated;

  const submit = form.form.handleSubmit((values) =>
    save.run(values, baseRevision, {
      onSaved: (savedValues, revision) => {
        form.form.reset(savedValues);
        setBaseRevision(revision);
      },
      onProblem: form.showProblem,
    }),
  );

  return (
    <section aria-labelledby="simulation-title" className="grid gap-6">
      <title>
        {simulation ? 'Simulação | InvestFlow' : 'Nova simulação | InvestFlow'}
      </title>
      <PageLabel icon={SimulationIcon}>
        <Link
          to={`/simulacoes${listSearch(searchParams)}`}
          className="text-accent"
        >
          Simulações
        </Link>
      </PageLabel>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <SimulationHeading saved={saved} />
        {simulation && (
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
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <SimulationFormPanel
          simulation={form}
          options={options}
          saved={saved}
          pending={save.pending}
          upToDate={upToDate}
          onSave={() => void submit()}
        />
        <CalculationPanel
          saved={saved}
          pending={save.pending}
          problem={save.problem}
          changedElsewhere={changedElsewhere}
          unsavedEdits={isDirty}
          taxRules={options.taxRules}
          retry={workspace.recalculate}
          onReload={() => void save.reload()}
        />
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir esta simulação?"
        description="A simulação e o resultado deixam de aparecer. A oferta e a curva continuam disponíveis. Não é possível desfazer."
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
