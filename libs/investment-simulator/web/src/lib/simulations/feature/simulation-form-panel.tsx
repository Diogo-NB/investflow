import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  UNSUPPORTED_LABELS,
  issuerAndNameLabel,
  offerTermsLabel,
  type RemunerationKind,
  type TitleType,
} from '../../offers/models/offer-terms';
import {
  offerSelectGroups,
  ORIGIN_LABELS,
} from '../../offers/utils/offer-groups';
import { useOfferSimulations } from '../../offers/feature/use-offer-details';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import { SelectField, type SelectOption } from '../../ui/select-field';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  CurveIcon,
  InfoIcon,
  OfferIcon,
  PlusIcon,
  SpinningRefreshIcon,
  SplitIcon,
} from '../../ui/icons';
import {
  bareInput,
  fieldBox,
  primaryButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import type {
  OfferOption,
  SimulationOffer,
  SimulationOptions,
  SimulationWorkspace,
  TitleTypeOption,
} from '../models/simulation.types';
import type { useSimulationForm } from './use-simulation-form';
import type { useSimulationTermsActions } from './use-simulation-terms-actions';

type SimulationForm = ReturnType<typeof useSimulationForm>;

const REDEMPTION_OPTIONS: SelectOption[] = (
  ['AT_MATURITY', 'DAILY'] as const
).map((kind) => ({ value: kind, label: REDEMPTION_LABELS[kind] }));

const legendClass =
  'float-left mb-4 w-full p-0 text-sm font-semibold tracking-wide text-muted uppercase';

function titleTypeHint(
  option: TitleTypeOption | undefined,
): string | undefined {
  if (!option) return undefined;
  const facts = [
    option.incomeTaxExempt
      ? 'Isento de IR para pessoa física'
      : 'IR regressivo de 22,5% a 15%',
    option.minimumTermMonths
      ? `vencimento mínimo de ${option.minimumTermMonths} meses`
      : null,
  ];
  return facts.filter(Boolean).join(' · ');
}

function OfferPicker({
  simulation,
  offers,
  savedOffer,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly offers: readonly OfferOption[];
  readonly savedOffer: SimulationWorkspace['offer'] | null;
  readonly pending: boolean;
}) {
  const { form, values, isOwnTerms, offer } = simulation;
  // A deleted offer is no longer listed but still names the saved choice.
  const deleted =
    savedOffer?.deleted === true && values.offerId === savedOffer.id;
  return (
    <Controller
      control={form.control}
      name="offerId"
      render={({ field, fieldState }) => (
        <FormField
          label="Oferta"
          // Issuer and apelido come with the offer; they are not terms.
          hint={offer && issuerAndNameLabel(offer)}
          error={
            fieldState.error?.message ??
            (deleted
              ? 'Oferta excluída. Escolha outra ou salve para manter estes termos só nesta simulação.'
              : undefined)
          }
        >
          {(control) => (
            <SelectField
              {...control}
              ref={field.ref}
              // Own terms and terms typed from scratch are not a listed offer.
              value={deleted || isOwnTerms ? '' : field.value}
              placeholder={
                isOwnTerms
                  ? 'Termos próprios'
                  : 'Escolha uma oferta ou preencha os termos'
              }
              disabled={pending || offers.length === 0}
              groups={offerSelectGroups(offers)}
              onValueChange={(value) => {
                const chosen = offers.find((offer) => offer.id === value);
                if (chosen) simulation.chooseOffer(chosen);
              }}
              onBlur={field.onBlur}
            />
          )}
        </FormField>
      )}
    />
  );
}

function TitleTypeField({
  simulation,
  options,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly pending: boolean;
}) {
  const { form, isOwnTerms } = simulation;
  return (
    <Controller
      control={form.control}
      name="titleType"
      render={({ field, fieldState }) => (
        <FormField
          label="Título"
          hint={titleTypeHint(
            options.titleTypes.find(
              (option) => option.titleType === field.value,
            ),
          )}
          error={fieldState.error?.message}
        >
          {(control) =>
            // A title type never changes once the terms are saved, as on an
            // offer.
            isOwnTerms ? (
              <p
                id={control.id}
                aria-describedby={control['aria-describedby']}
                className="m-0 font-medium"
              >
                {field.value}
              </p>
            ) : (
              <SelectField
                {...control}
                ref={field.ref}
                value={field.value}
                placeholder="Escolha"
                disabled={pending}
                options={options.titleTypes.map(({ titleType }) => ({
                  value: titleType,
                  label: titleType,
                }))}
                onValueChange={(value) => field.onChange(value as TitleType)}
                onBlur={field.onBlur}
              />
            )
          }
        </FormField>
      )}
    />
  );
}

// The picker already says "Termos próprios"; this names where they came from.
function TermsBase({ base }: { readonly base: SimulationOffer['basedOn'] }) {
  if (!base) return null;
  return (
    <p className="m-0 flex items-start gap-2 text-sm text-muted">
      <SplitIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        Baseados em {offerTermsLabel(base)}
        {base.deleted && ' (excluída)'}
      </span>
    </p>
  );
}

// What saving does to the terms, said before the user saves.
function termsConsequence(simulation: SimulationForm): string | null {
  if (!simulation.termsChanged) return null;
  if (simulation.isOwnTerms) {
    return 'Ao salvar, os termos desta simulação mudam. Nenhuma oferta muda.';
  }
  return simulation.offer
    ? 'Ao salvar, esta simulação passa a ter termos próprios. A oferta não muda.'
    : 'Ao salvar, estes termos ficam só nesta simulação.';
}

type TermsActions = ReturnType<typeof useSimulationTermsActions>;

function TermsActionsBar({
  actions,
  dirty,
}: {
  readonly actions: TermsActions;
  readonly dirty: boolean;
}) {
  const [confirming, setConfirming] = useState<'return' | 'apply' | null>(null);
  const { base } = actions;
  const users = useOfferSimulations(
    confirming === 'apply' ? base?.id : undefined,
    { pageSize: 1 },
  ).state;
  const disabled = dirty || actions.pending;
  const close = () => {
    setConfirming(null);
    actions.returnToOffer.reset();
    actions.applyToOffer.reset();
  };
  const applyNotice = (() => {
    if (!base) return '';
    const count =
      users.status !== 'ready'
        ? 'As simulações que usam esta oferta serão recalculadas.'
        : users.total === 0
          ? 'Nenhuma outra simulação usa esta oferta.'
          : users.total === 1
            ? 'A simulação que usa esta oferta será recalculada.'
            : `As ${users.total} simulações que usam esta oferta serão recalculadas.`;
    return `A oferta ${offerTermsLabel(base)} passa a ter os termos desta simulação, que volta a segui-la. ${count}`;
  })();

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {base && (
          <button
            type="button"
            className={secondaryButton}
            disabled={disabled}
            onClick={() => setConfirming('return')}
          >
            <ChevronLeftIcon className="size-4 shrink-0" />
            Voltar à oferta
          </button>
        )}
        {base && actions.canApply && (
          <button
            type="button"
            className={secondaryButton}
            disabled={disabled}
            onClick={() => setConfirming('apply')}
          >
            <ArrowRightIcon className="size-4 shrink-0" />
            Aplicar à oferta
          </button>
        )}
        <button
          type="button"
          className={secondaryButton}
          disabled={disabled}
          onClick={actions.moveToCatalog.run}
        >
          <PlusIcon className="size-4 shrink-0" />
          Salvar como oferta
        </button>
      </div>
      {dirty && (
        <p className="m-0 text-sm text-muted">Salve as alterações antes.</p>
      )}
      {base && (
        <>
          <ConfirmDialog
            open={confirming === 'return'}
            onOpenChange={(open) => !open && close()}
            title="Descartar os termos próprios?"
            description={`Esta simulação volta a seguir a oferta ${offerTermsLabel(base)}, e os termos próprios são descartados.`}
            cancelLabel="Manter termos próprios"
            confirmLabel={actions.pending ? 'Voltando…' : 'Voltar à oferta'}
            pending={actions.pending}
            error={actions.returnToOffer.failed ?? undefined}
            onConfirm={() => actions.returnToOffer.run(base)}
          />
          <ConfirmDialog
            open={confirming === 'apply'}
            onOpenChange={(open) => !open && close()}
            title={`Aplicar estes termos à oferta ${offerTermsLabel(base)}?`}
            description={applyNotice}
            cancelLabel="Cancelar"
            confirmLabel={actions.pending ? 'Aplicando…' : 'Aplicar à oferta'}
            pending={actions.pending}
            error={actions.applyToOffer.failed ?? undefined}
            onConfirm={() => actions.applyToOffer.run(base)}
          />
        </>
      )}
    </div>
  );
}

function OfferSection({
  simulation,
  options,
  saved,
  pending,
  termsActions,
}: {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly saved: SimulationWorkspace | null;
  readonly pending: boolean;
  readonly termsActions: TermsActions | null;
}) {
  const consequence = termsConsequence(simulation);
  // No offer is behind terms typed from scratch, so the issuer is typed too.
  const issuerEditable =
    !simulation.offer || (simulation.isOwnTerms && !saved?.offer.basedOn);
  // Own terms as saved; a chosen offer replaces them until the next save.
  const showsOwnTerms =
    saved !== null &&
    saved.offer.scope === 'SIMULATION' &&
    simulation.isOwnTerms;
  return (
    <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
      <legend className={legendClass}>
        <span className="flex items-center gap-2">
          <OfferIcon className="size-4 shrink-0" />
          Oferta
        </span>
      </legend>
      <OfferPicker
        simulation={simulation}
        offers={options.offers}
        savedOffer={saved?.offer ?? null}
        pending={pending}
      />
      {showsOwnTerms && saved && <TermsBase base={saved.offer.basedOn} />}
      <TitleTypeField
        simulation={simulation}
        options={options}
        pending={pending}
      />
      <OfferTermFields
        simulation={simulation}
        options={options}
        pending={pending}
        issuerEditable={issuerEditable}
      />
      <div aria-live="polite">
        {consequence && (
          <p className="m-0 flex items-start gap-2 text-sm text-muted">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>{consequence}</span>
          </p>
        )}
      </div>
      {showsOwnTerms && saved && termsActions && (
        <TermsActionsBar
          actions={termsActions}
          dirty={simulation.form.formState.isDirty}
        />
      )}
    </fieldset>
  );
}

// The fields a calculation reads, plus the issuer where no offer is behind
// the terms to give one.
function OfferTermFields({
  simulation,
  options,
  pending,
  issuerEditable,
}: {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly pending: boolean;
  readonly issuerEditable: boolean;
}) {
  const { form, values } = simulation;
  const { errors } = form.formState;
  const kind = values.remunerationKind;
  // Kinds the calculator cannot price stay visible but cannot be chosen.
  const kindOptions: SelectOption[] = options.remunerations.map((option) => ({
    value: option.kind,
    label: REMUNERATION_LABELS[option.kind],
    ...(option.unsupportedReason
      ? { disabled: true, detail: UNSUPPORTED_LABELS[option.unsupportedReason] }
      : {}),
  }));

  return (
    <>
      {issuerEditable && (
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
                disabled={pending}
                className={bareInput}
              />
            </div>
          )}
        </FormField>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Controller
          control={form.control}
          name="remunerationKind"
          render={({ field, fieldState }) => (
            <FormField label="Remuneração" error={fieldState.error?.message}>
              {(control) => (
                <SelectField
                  {...control}
                  ref={field.ref}
                  value={field.value}
                  placeholder="Escolha"
                  disabled={pending}
                  options={kindOptions}
                  onValueChange={(next) =>
                    simulation.changeKind(next as RemunerationKind)
                  }
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Controller
          control={form.control}
          name="maturityDate"
          render={({ field, fieldState }) => (
            <FormField label="Vencimento" error={fieldState.error?.message}>
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
    </>
  );
}

function InvestmentFieldset({
  simulation,
  savedCurve,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly savedCurve: SimulationWorkspace['curve'];
  readonly pending: boolean;
}) {
  const { form, values, index, curveOptions, curve, startsBeforeCurve } =
    simulation;
  const curveDeleted =
    savedCurve?.deleted === true && values.curveId === savedCurve.id;
  const { errors } = form.formState;
  const curveHint = (() => {
    if (!curve) return undefined;
    if (startsBeforeCurve) {
      return `A curva começa em ${formatIsoDate(curve.coverage.startDate)} e não cobre a data da aplicação.`;
    }
    return `Cobertura de ${formatIsoDate(curve.coverage.startDate)} a ${formatIsoDate(curve.coverage.endDate)}; o último valor vale em diante.`;
  })();
  const curveGroups = (['SYSTEM', 'OWN'] as const)
    .map((origin) => ({
      label: ORIGIN_LABELS[origin],
      options: curveOptions
        .filter((option) => option.origin === origin)
        .map((option) => ({
          value: option.id,
          label: option.name,
          ...(option.description ? { detail: option.description } : {}),
        })),
    }))
    .filter((group) => group.options.length > 0);

  return (
    <fieldset
      disabled={pending}
      className="m-0 grid gap-4 border-0 border-t border-border p-0 pt-6"
    >
      <legend className={legendClass}>Investimento</legend>
      <FormField label="Valor aplicado (R$)" error={errors.principal?.message}>
        {(control) => (
          <DecimalInput
            {...control}
            {...form.register('principal')}
            prefix="R$"
            placeholder="10.000,00"
          />
        )}
      </FormField>
      <Controller
        control={form.control}
        name="investmentDate"
        render={({ field, fieldState }) => (
          <FormField
            label="Data da aplicação"
            error={fieldState.error?.message}
            hint="Precisa ser dia útil."
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
      {index && (
        <Controller
          control={form.control}
          name="curveId"
          render={({ field, fieldState }) => (
            <FormField
              label={`Curva do ${index}`}
              icon={CurveIcon}
              error={
                fieldState.error?.message ??
                (curveDeleted ? 'Sem curva, escolha outra.' : undefined)
              }
              hint={
                curveOptions.length === 0
                  ? `Não há curvas de ${index} disponíveis.`
                  : curveHint
              }
            >
              {(control) => (
                <SelectField
                  {...control}
                  ref={field.ref}
                  value={curveDeleted ? '' : field.value}
                  placeholder="Escolha a curva"
                  disabled={pending || curveOptions.length === 0}
                  groups={curveGroups}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
          )}
        />
      )}
    </fieldset>
  );
}

function SaveHint({
  simulation,
  saved,
}: {
  readonly simulation: SimulationForm;
  readonly saved: SimulationWorkspace | null;
}) {
  const text = (() => {
    if (simulation.termsChanged) {
      return simulation.isOwnTerms
        ? 'Salvar altera os termos desta simulação e recalcula o resultado.'
        : 'Salvar guarda estes termos só nesta simulação e calcula o resultado.';
    }
    return saved
      ? 'Salvar recalcula o resultado com a oferta e a curva atuais.'
      : 'Salvar cria a simulação e calcula o resultado.';
  })();
  return <p className="m-0 text-sm text-muted">{text}</p>;
}

interface SimulationFormPanelProps {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  // The saved simulation; null while creating one.
  readonly saved: SimulationWorkspace | null;
  readonly pending: boolean;
  readonly upToDate: boolean;
  // What a saved simulation with its own terms can do with them.
  readonly termsActions: TermsActions | null;
  readonly onSave: () => void;
}

export function SimulationFormPanel({
  simulation,
  options,
  saved,
  pending,
  upToDate,
  termsActions,
  onSave,
}: SimulationFormPanelProps) {
  return (
    <form
      noValidate
      aria-labelledby="inputs-title"
      className={`${surface} grid content-start gap-6 p-6 lg:sticky lg:top-6`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2 id="inputs-title" className="m-0 text-lg font-semibold">
        Entradas
      </h2>
      <OfferSection
        simulation={simulation}
        options={options}
        saved={saved}
        pending={pending}
        termsActions={termsActions}
      />
      <InvestmentFieldset
        simulation={simulation}
        savedCurve={saved?.curve ?? null}
        pending={pending}
      />

      <div className="grid gap-2 border-t border-border pt-6">
        <button
          type="submit"
          className={primaryButton}
          disabled={pending || upToDate}
        >
          {pending ? (
            <>
              <SpinningRefreshIcon />
              Salvando…
            </>
          ) : upToDate ? (
            <>
              <CheckCircleIcon />
              Resultado atualizado
            </>
          ) : (
            'Salvar e calcular'
          )}
        </button>
        <SaveHint simulation={simulation} saved={saved} />
      </div>
    </form>
  );
}
