import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  OfferIcon,
  PlusIcon,
  SpinningRefreshIcon,
} from '../../ui/icons';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import { SelectField, type SelectOption } from '../../ui/select-field';
import {
  bareInput,
  fieldBox,
  primaryButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import { useUnsavedChangesGuard } from '../../ui/use-unsaved-changes-guard';
import {
  offerTermsLabel,
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  UNSUPPORTED_LABELS,
  type RemunerationKind,
  type TitleType,
} from '../models/offer-terms';
import type { OfferSummary } from '../models/offer.types';
import {
  changesOfferTerms,
  offerFormSchema,
  type OfferFormValues,
} from '../utils/offer-form';
import type { OfferSimulationsState } from './use-offer-details';
import { useOfferEditor, type OfferSaveProblem } from './use-offer-editor';

type Editor = ReturnType<typeof useOfferEditor>;

const TITLE_TYPE_OPTIONS: SelectOption[] = (['CDB', 'LCI', 'LCA'] as const).map(
  (type) => ({ value: type, label: type }),
);

const KIND_OPTIONS: SelectOption[] = (
  ['PREFIXED', 'CDI_PERCENTAGE', 'SELIC_PERCENTAGE', 'IPCA_PLUS'] as const
).map((kind) => ({
  value: kind,
  label: REMUNERATION_LABELS[kind],
  ...(kind === 'IPCA_PLUS'
    ? { detail: UNSUPPORTED_LABELS.INVESTMENT_REMUNERATION_UNSUPPORTED }
    : {}),
}));

const REDEMPTION_OPTIONS: SelectOption[] = (
  ['AT_MATURITY', 'DAILY'] as const
).map((kind) => ({ value: kind, label: REDEMPTION_LABELS[kind] }));

function ImpactNotice({ state }: { readonly state: OfferSimulationsState }) {
  if (state.status !== 'ready' || state.total === 0) return null;
  const count =
    state.total === 1
      ? 'A simulação que usa esta oferta será recalculada.'
      : `As ${state.total} simulações que usam esta oferta serão recalculadas.`;
  return (
    <p className="m-0 flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-sm text-warning motion-safe:animate-fade-in">
      <AlertTriangleIcon className="size-5 shrink-0" />
      {count}
    </p>
  );
}

function OfferEditorForm({
  editor,
  offer,
  initialValues,
}: {
  readonly editor: Editor;
  readonly offer: OfferSummary | null;
  readonly initialValues: OfferFormValues;
}) {
  // Edits are measured against the version the form started from, never a
  // later read.
  const [baseline] = useState(offer);
  const { save, listSearch } = editor;
  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });
  const kind = useWatch({ control: form.control, name: 'remunerationKind' });
  // Only changes a calculation reads recalculate the simulations.
  const recalculates = useWatch({
    control: form.control,
    compute: (values) =>
      baseline !== null && changesOfferTerms(baseline, values),
  });
  const { errors, isDirty } = form.formState;
  const blocker = useUnsavedChangesGuard(isDirty && !save.pending);
  const pending = save.pending;
  const problem = save.problem;

  function focusProblem(problem: OfferSaveProblem) {
    if (!problem.field) return;
    form.setError(
      problem.field,
      { type: 'server', message: problem.message },
      { shouldFocus: true },
    );
  }

  const submit = form.handleSubmit((values) =>
    baseline
      ? save.edit(baseline, values, focusProblem)
      : save.create(values, focusProblem),
  );

  return (
    <>
      <form
        noValidate
        className={`${surface} grid max-w-2xl gap-4 p-6`}
        onSubmit={(event) => void submit(event)}
      >
        <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
          {baseline ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Título</span>
              <span>
                {baseline.titleType}{' '}
                <span className="text-sm text-muted">
                  · não muda depois de criado
                </span>
              </span>
            </div>
          ) : (
            <Controller
              control={form.control}
              name="titleType"
              render={({ field, fieldState }) => (
                <FormField label="Título" error={fieldState.error?.message}>
                  {(control) => (
                    <SelectField
                      {...control}
                      ref={field.ref}
                      value={field.value}
                      placeholder="Escolha"
                      disabled={pending}
                      options={TITLE_TYPE_OPTIONS}
                      onValueChange={(value) =>
                        field.onChange(value as TitleType)
                      }
                      onBlur={field.onBlur}
                    />
                  )}
                </FormField>
              )}
            />
          )}
          <FormField
            label="Emissor (opcional)"
            error={errors.issuerName?.message}
          >
            {(control) => (
              <div className={fieldBox}>
                <input
                  {...control}
                  {...form.register('issuerName')}
                  type="text"
                  maxLength={100}
                  placeholder="Sem emissor"
                  className={bareInput}
                />
              </div>
            )}
          </FormField>
          <FormField label="Apelido (opcional)" error={errors.name?.message}>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="remunerationKind"
              render={({ field, fieldState }) => (
                <FormField
                  label="Remuneração"
                  error={fieldState.error?.message}
                >
                  {(control) => (
                    <SelectField
                      {...control}
                      ref={field.ref}
                      value={field.value}
                      placeholder="Escolha"
                      disabled={pending}
                      options={KIND_OPTIONS}
                      onValueChange={(next) => {
                        // The rate's unit depends on the kind.
                        field.onChange(next as RemunerationKind);
                        form.setValue('rate', '', { shouldDirty: true });
                        form.clearErrors('rate');
                      }}
                      onBlur={field.onBlur}
                    />
                  )}
                </FormField>
              )}
            />
            <FormField
              label={`Taxa (${RATE_UNITS[kind]})`}
              error={errors.rate?.message}
            >
              {(control) => (
                <DecimalInput
                  {...control}
                  {...form.register('rate')}
                  suffix={RATE_UNITS[kind]}
                  placeholder={kind === 'PREFIXED' ? '12,5' : '110'}
                />
              )}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="maturityDate"
              render={({ field, fieldState }) => (
                <FormField
                  label="Vencimento"
                  hint="Simulações exigem vencimento em dia útil."
                  error={fieldState.error?.message}
                >
                  {(control) => (
                    <BusinessDateField
                      {...control}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={pending}
                    />
                  )}
                </FormField>
              )}
            />
            <Controller
              control={form.control}
              name="redemptionKind"
              render={({ field, fieldState }) => (
                <FormField label="Liquidez" error={fieldState.error?.message}>
                  {(control) => (
                    <SelectField
                      {...control}
                      ref={field.ref}
                      value={field.value}
                      placeholder="Escolha"
                      disabled={pending}
                      options={REDEMPTION_OPTIONS}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                </FormField>
              )}
            />
          </div>
        </fieldset>

        {recalculates && <ImpactNotice state={editor.simulations} />}

        <div aria-live="polite">
          {problem && !problem.field && (
            <div role="alert" className="grid justify-items-start gap-2">
              <p className="m-0 text-sm text-error">
                {problem.conflict
                  ? 'Esta oferta foi alterada em outro lugar. Recarregue para ver a versão salva; suas alterações nesta tela serão descartadas.'
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
            {pending ? 'Salvando…' : baseline ? 'Salvar' : 'Criar oferta'}
          </button>
          <Link
            to={
              baseline
                ? `/ofertas/${baseline.id}${listSearch}`
                : `/ofertas${listSearch}`
            }
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
        description="As alterações desta oferta ainda não foram salvas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar alterações"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}

export function OfferEditorPage() {
  const { offerId } = useParams();
  const editor = useOfferEditor(offerId);
  const { setup, listSearch } = editor;
  const creating = offerId === undefined;

  return (
    <section aria-labelledby="offer-editor-title" className="grid gap-6">
      <title>
        {creating ? 'Nova oferta | InvestFlow' : 'Editar oferta | InvestFlow'}
      </title>
      <PageLabel icon={OfferIcon}>
        <Link to={`/ofertas${listSearch}`} className="text-accent">
          Ofertas
        </Link>
      </PageLabel>
      {setup.status === 'loading' && (
        <p role="status" className="m-0 text-muted">
          <span id="offer-editor-title">Carregando oferta…</span>
        </p>
      )}
      {setup.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="offer-editor-title" className="m-0 text-xl font-semibold">
            Oferta não encontrada
          </h1>
          <p className="m-0 text-muted">Ela pode ter sido excluída.</p>
          <Link to={`/ofertas${listSearch}`} className={secondaryButton}>
            Ver ofertas
          </Link>
        </div>
      )}
      {setup.status === 'read-only' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="offer-editor-title" className="m-0 text-xl font-semibold">
            {offerTermsLabel(setup.offer)}
          </h1>
          <p className="m-0 max-w-prose text-muted">
            Ofertas do sistema não podem ser alteradas. Duplique para ter uma
            cópia sua e editá-la.
          </p>
          <Link
            to={`/ofertas/${setup.offer.id}${listSearch}`}
            className={secondaryButton}
          >
            Ver oferta
          </Link>
        </div>
      )}
      {setup.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="offer-editor-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a oferta
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
              id="offer-editor-title"
              icon={OfferIcon}
              subtitle={
                setup.offer
                  ? 'As alterações valem para todas as simulações que usam esta oferta.'
                  : 'A oferta fica em Minhas e pode ser usada nas suas simulações.'
              }
            >
              {setup.offer
                ? `Editar ${offerTermsLabel(setup.offer)}`
                : 'Nova oferta'}
            </PageTitle>
          </header>
          <OfferEditorForm
            // A new form for each offer and each reload; never per read, so a
            // refetch cannot discard unsaved input.
            key={`${setup.offer?.id ?? 'new'}:${setup.loadGeneration}`}
            editor={editor}
            offer={setup.offer}
            initialValues={setup.initialValues}
          />
        </>
      )}
    </section>
  );
}
