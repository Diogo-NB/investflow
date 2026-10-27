import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FormField } from '../../ui/form-field';
import {
  CheckCircleIcon,
  InvestmentPlanIcon,
  PlusIcon,
  SpinningRefreshIcon,
} from '../../ui/icons';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import {
  bareInput,
  fieldBox,
  primaryButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import { useUnsavedChangesGuard } from '../../ui/use-unsaved-changes-guard';
import type { InvestmentPlanDetail } from '../models/investment-plan.types';
import {
  investmentPlanFormSchema,
  type InvestmentPlanFormValues,
} from '../utils/investment-plan-form';
import { useInvestmentPlanEditor } from './use-investment-plan-editor';

type Editor = ReturnType<typeof useInvestmentPlanEditor>;

function InvestmentPlanEditorForm({
  editor,
  plan,
  initialValues,
}: {
  readonly editor: Editor;
  readonly plan: InvestmentPlanDetail | null;
  readonly initialValues: InvestmentPlanFormValues;
}) {
  // Edits are measured against the version the form started from, never a
  // later read.
  const [baseline] = useState(plan);
  const { save } = editor;
  const form = useForm<InvestmentPlanFormValues>({
    resolver: zodResolver(investmentPlanFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });
  const { errors, isDirty } = form.formState;
  const blocker = useUnsavedChangesGuard(isDirty && !save.pending);
  const { pending, problem } = save;

  const submit = form.handleSubmit((values) =>
    baseline ? save.edit(baseline, values) : save.create(values),
  );

  return (
    <>
      <form
        noValidate
        className={`${surface} grid max-w-2xl gap-4 p-6`}
        onSubmit={(event) => void submit(event)}
      >
        <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
          <FormField label="Nome do plano" error={errors.name?.message}>
            {(control) => (
              <div className={fieldBox}>
                <input
                  {...control}
                  {...form.register('name')}
                  type="text"
                  maxLength={100}
                  placeholder="Reserva de emergência"
                  className={bareInput}
                />
              </div>
            )}
          </FormField>
          <FormField
            label="Descrição (opcional)"
            error={errors.description?.message}
          >
            {(control) => (
              <textarea
                {...control}
                {...form.register('description')}
                rows={3}
                maxLength={500}
                placeholder="O objetivo e o prazo deste dinheiro"
                className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-fg placeholder:text-muted hover:border-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-error disabled:bg-bg disabled:text-muted"
              />
            )}
          </FormField>
        </fieldset>

        <div aria-live="polite">
          {problem && (
            <div role="alert" className="grid justify-items-start gap-2">
              <p className="m-0 text-sm text-error">
                {problem.conflict
                  ? 'Este plano foi alterado em outro lugar. Recarregue para ver a versão salva; suas alterações nesta tela serão descartadas.'
                  : problem.message}
              </p>
              {problem.conflict && (
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => void save.reload()}
                >
                  Recarregar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className={primaryButton}
            disabled={pending || (baseline !== null && !isDirty)}
          >
            {pending ? (
              <SpinningRefreshIcon className="size-5" />
            ) : baseline ? (
              <CheckCircleIcon className="size-5 shrink-0" />
            ) : (
              <PlusIcon className="size-5 shrink-0" />
            )}
            {pending ? 'Salvando…' : baseline ? 'Salvar' : 'Criar plano'}
          </button>
          <Link
            to={baseline ? `/planos/${baseline.id}` : '/planos'}
            className={secondaryButton}
          >
            Cancelar
          </Link>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Descartar alterações?"
        description="As alterações deste plano ainda não foram salvas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar alterações"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}

export function InvestmentPlanEditorPage() {
  const { investmentPlanId } = useParams();
  const editor = useInvestmentPlanEditor(investmentPlanId);
  const { setup } = editor;
  const creating = investmentPlanId === undefined;

  return (
    <section
      aria-labelledby="investment-plan-editor-title"
      className="grid gap-6"
    >
      <title>
        {creating ? 'Novo plano | InvestFlow' : 'Editar plano | InvestFlow'}
      </title>
      <PageLabel icon={InvestmentPlanIcon}>
        <Link to="/planos" className="text-accent">
          Planos
        </Link>
      </PageLabel>
      {setup.status === 'loading' && (
        <p role="status" className="m-0 text-muted">
          <span id="investment-plan-editor-title">Carregando plano…</span>
        </p>
      )}
      {setup.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1
            id="investment-plan-editor-title"
            className="m-0 text-xl font-semibold"
          >
            Plano não encontrado
          </h1>
          <p className="m-0 text-muted">Ele pode ter sido excluído.</p>
          <Link to="/planos" className={secondaryButton}>
            Ver planos
          </Link>
        </div>
      )}
      {setup.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1
            id="investment-plan-editor-title"
            className="m-0 text-xl font-semibold"
          >
            Não foi possível abrir o plano
          </h1>
          <button
            type="button"
            className={secondaryButton}
            disabled={setup.retrying}
            onClick={editor.retrySetup}
          >
            {setup.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {setup.status === 'ready' && (
        <>
          <header>
            <PageTitle
              id="investment-plan-editor-title"
              icon={InvestmentPlanIcon}
              subtitle={
                setup.plan
                  ? 'O nome e a descrição; as simulações mudam na página do plano.'
                  : 'Depois de criar, adicione as simulações em que você investiria junto.'
              }
            >
              {setup.plan ? `Editar ${setup.plan.name}` : 'Novo plano'}
            </PageTitle>
          </header>
          <InvestmentPlanEditorForm
            // A new form for each plan and each reload; never per read, so a
            // refetch cannot discard unsaved input.
            key={`${setup.plan?.id ?? 'new'}:${setup.loadGeneration}`}
            editor={editor}
            plan={setup.plan}
            initialValues={setup.initialValues}
          />
        </>
      )}
    </section>
  );
}
