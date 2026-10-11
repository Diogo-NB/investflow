import { useState } from 'react';
import { Link } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { PageLabel } from '../../ui/page-label';
import { quietButton, secondaryButton } from '../../ui/styles';
import type {
  CalculationSummary,
  Investment,
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';
import type { SimulationFormValues } from '../utils/simulation-form';
import { CalculationPanel } from './calculation-panel';
import { SimulationFormPanel } from './simulation-form-panel';
import { useCalculationHistory } from './use-calculation-history';
import { useSimulationForm } from './use-simulation-form';
import {
  TEMPLATE_PARAM,
  type useSimulationWorkspace,
} from './use-simulation-workspace';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

type Workspace = ReturnType<typeof useSimulationWorkspace>;

type SavedSimulation = SimulationWorkspace['simulation'];

interface SimulationEditorProps {
  readonly simulation: SavedSimulation | null;
  readonly calculations: readonly CalculationSummary[];
  readonly initialValues: SimulationFormValues;
  readonly options: SimulationOptions;
  readonly workspace: Workspace;
}

function SimulationHeading({
  simulation,
  current,
}: {
  readonly simulation: SavedSimulation | null;
  readonly current: Investment | null;
}) {
  if (!simulation || !current) {
    return (
      <div className="max-w-prose">
        <h1
          id="simulation-title"
          className="m-0 text-xl leading-tight font-semibold sm:text-2xl"
        >
          Nova simulação
        </h1>
        <p className="mt-2 mb-0 text-muted">
          Informe quanto e quando investir e os termos do título.
        </p>
      </div>
    );
  }
  const { terms } = simulation;
  return (
    <div className="max-w-prose">
      <h1
        id="simulation-title"
        className="m-0 text-xl leading-tight font-semibold sm:text-2xl"
      >
        {[
          terms.issuerName,
          `${terms.titleType} ${remunerationLabel(terms.remunerationTerms)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </h1>
      <p className="mt-2 mb-0 text-muted">
        {formatMoney(current.principal)} de{' '}
        {formatIsoDate(current.investmentDate)} a{' '}
        {formatIsoDate(terms.maturityDate)} ·{' '}
        {simulation.fromCatalogOffer
          ? 'Termos de uma oferta do catálogo'
          : 'Termos personalizados'}
      </p>
    </div>
  );
}

export function SimulationEditor({
  simulation,
  calculations,
  initialValues,
  options,
  workspace,
}: SimulationEditorProps) {
  const isNew = simulation === null;
  const form = useSimulationForm({
    initialValues,
    remunerations: options.remunerations,
  });
  const history = useCalculationHistory(calculations);
  const { calculate, remove } = workspace;
  const { isDirty } = form.form.formState;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const blocker = useUnsavedChangesGuard(
    isDirty && !calculate.pending && !remove.pending,
  );

  const latest = history.latest;
  const upToDate = !isNew && !isDirty && latest !== null && !latest.outdated;

  const submit = form.form.handleSubmit((values) =>
    calculate.run(values, {
      onSaved: (saved) => form.form.reset(saved),
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
        <SimulationHeading
          simulation={simulation}
          current={latest?.investment ?? null}
        />
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
          savedTerms={simulation?.terms ?? null}
          pending={calculate.pending}
          upToDate={upToDate}
          onCalculate={() => void submit()}
        />
        <CalculationPanel
          history={history}
          pending={calculate.pending}
          problem={calculate.problem}
          unsavedEdits={isDirty}
          taxRules={options.taxRules}
          maturityDate={simulation?.terms.maturityDate ?? null}
        />
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir esta simulação?"
        description="A simulação e o histórico de cálculos deixam de aparecer. Não é possível desfazer."
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
        description="As alterações desta simulação ainda não foram calculadas nem salvas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar alterações"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </section>
  );
}
