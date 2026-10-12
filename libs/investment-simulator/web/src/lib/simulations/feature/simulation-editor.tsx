import { useState } from 'react';
import { Link } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { PageLabel } from '../../ui/page-label';
import { quietButton, secondaryButton } from '../../ui/styles';
import type {
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';
import type { SimulationFormValues } from '../utils/simulation-form';
import { CalculationPanel } from './calculation-panel';
import { SimulationFormPanel } from './simulation-form-panel';
import { useSimulationForm } from './use-simulation-form';
import {
  TEMPLATE_PARAM,
  type useSimulationWorkspace,
} from './use-simulation-workspace';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

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
      <div className="max-w-prose">
        <h1
          id="simulation-title"
          className="m-0 text-xl leading-tight font-semibold sm:text-2xl"
        >
          Nova simulação
        </h1>
        <p className="mt-2 mb-0 text-muted">
          Escolha uma oferta e informe quanto e quando investir.
        </p>
      </div>
    );
  }
  const { offer, simulation } = saved;
  return (
    <div className="max-w-prose">
      <h1
        id="simulation-title"
        className="m-0 text-xl leading-tight font-semibold sm:text-2xl"
      >
        {[
          offer.name,
          `${offer.titleType} ${remunerationLabel(offer.remunerationTerms)}`,
        ].join(' · ')}
      </h1>
      <p className="mt-2 mb-0 text-muted">
        {formatMoney(simulation.investment.principal)} de{' '}
        {formatIsoDate(simulation.investment.investmentDate)} a{' '}
        {formatIsoDate(offer.maturityDate)} ·{' '}
        {offer.deleted ? 'Oferta excluída' : ORIGIN_LABELS[offer.origin]}
      </p>
    </div>
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
  const { isDirty } = form.form.formState;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const blocker = useUnsavedChangesGuard(
    isDirty && !save.pending && !remove.pending,
  );

  const upToDate = !isDirty && result !== null && !result.outdated;

  const submit = form.form.handleSubmit((values) =>
    save.run(values, {
      onSaved: (savedValues) => form.form.reset(savedValues),
      onProblem: form.showProblem,
    }),
  );

  return (
    <section aria-labelledby="simulation-title" className="grid gap-6">
      <title>
        {simulation ? 'Simulação | InvestFlow' : 'Nova simulação | InvestFlow'}
      </title>
      <PageLabel>
        <Link to="/simulacoes" className="text-accent">
          Simulações
        </Link>
      </PageLabel>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <SimulationHeading saved={saved} />
        {simulation && (
          <div className="flex flex-wrap gap-2">
            <Link to="/simulacoes/nova" className={secondaryButton}>
              Nova simulação
            </Link>
            <Link
              to={`/simulacoes/nova?${TEMPLATE_PARAM}=${simulation.id}`}
              className={secondaryButton}
            >
              Duplicar
            </Link>
            <button
              type="button"
              className={`${quietButton} text-error`}
              onClick={() => setConfirmingDelete(true)}
            >
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
          simulationId={simulation?.id ?? null}
          result={result}
          pending={save.pending}
          problem={save.problem}
          unsavedEdits={isDirty}
          taxRules={options.taxRules}
          onReload={save.reload}
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
