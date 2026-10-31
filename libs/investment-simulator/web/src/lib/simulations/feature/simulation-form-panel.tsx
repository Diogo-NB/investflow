import { useRef, type ReactNode, type RefObject } from 'react';
import { Controller } from 'react-hook-form';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  UNSUPPORTED_LABELS,
  offerTermsLabel,
  type RemunerationKind,
  type TitleType,
} from '../../offers/models/offer-terms';
import {
  offerSelectGroups,
  ORIGIN_LABELS,
} from '../../offers/utils/offer-groups';
import {
  useOfferSimulations,
  type OfferSimulationsState,
} from '../../offers/feature/use-offer-details';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import { SelectField, type SelectOption } from '../../ui/select-field';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  CopyIcon,
  CurveIcon,
  InfoIcon,
  OfferIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SpinningRefreshIcon,
  XIcon,
} from '../../ui/icons';
import {
  bareInput,
  fieldBox,
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import type {
  OfferOption,
  SimulationOptions,
  SimulationWorkspace,
  TitleTypeOption,
} from '../models/simulation.types';
import type { useSimulationForm } from './use-simulation-form';

type SimulationForm = ReturnType<typeof useSimulationForm>;

const REDEMPTION_OPTIONS: SelectOption[] = (
  ['AT_MATURITY', 'DAILY'] as const
).map((kind) => ({ value: kind, label: REDEMPTION_LABELS[kind] }));

type OfferTerms = Omit<OfferOption, 'unsupportedReason'>;

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
  const { form, values } = simulation;
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
          error={
            fieldState.error?.message ??
            (deleted ? 'Sem oferta, escolha outra.' : undefined)
          }
          hint={
            offers.length === 0
              ? 'Não há ofertas disponíveis. Digite os termos.'
              : undefined
          }
        >
          {(control) => (
            <SelectField
              {...control}
              ref={field.ref}
              value={deleted ? '' : field.value}
              placeholder="Escolha uma oferta"
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

// Focus moves only once the section the action opened has rendered.
function focusLater(focus: () => void) {
  requestAnimationFrame(focus);
}

interface OfferSectionProps {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly savedOffer: SimulationWorkspace['offer'] | null;
  readonly pending: boolean;
  // Where focus returns when a mode closes.
  readonly actionsRef: RefObject<HTMLButtonElement | null>;
}

function ChosenOffer({
  simulation,
  options,
  savedOffer,
  pending,
  actionsRef,
}: OfferSectionProps) {
  const { offer } = simulation;
  const editable = offer?.origin === 'OWN';
  const focusIssuer = () =>
    focusLater(() => simulation.form.setFocus('issuerName'));
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
        savedOffer={savedOffer}
        pending={pending}
      />
      {offer && <TermsSummary terms={offer} />}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <button
            ref={actionsRef}
            type="button"
            className={secondaryButton}
            disabled={pending}
            onClick={() => {
              simulation.editOffer();
              focusIssuer();
            }}
          >
            <PencilIcon className="size-4 shrink-0" />
            Editar oferta
          </button>
        )}
        <button
          ref={editable ? undefined : actionsRef}
          type="button"
          className={secondaryButton}
          disabled={pending || !offer}
          onClick={() => {
            simulation.duplicateOffer();
            focusIssuer();
          }}
        >
          <CopyIcon className="size-4 shrink-0" />
          Duplicar e ajustar
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={() => {
            simulation.newOffer();
            focusLater(() => simulation.form.setFocus('titleType'));
          }}
        >
          <PlusIcon className="size-4 shrink-0" />
          Nova oferta
        </button>
      </div>
    </fieldset>
  );
}

function OfferConsequence({
  tone,
  children,
}: {
  readonly tone: 'info' | 'warning';
  readonly children: ReactNode;
}) {
  return tone === 'warning' ? (
    <p className="m-0 flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-sm text-warning motion-safe:animate-fade-in">
      <AlertTriangleIcon className="size-5 shrink-0" />
      <span>{children}</span>
    </p>
  ) : (
    <p className="m-0 flex items-start gap-2 text-sm text-muted">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// The fields an offer's terms share whether edited or new; the title type
// differs, since it is fixed once the offer exists.
function OfferTermFields({
  simulation,
  options,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly pending: boolean;
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
      <FormField label="Emissor (opcional)" error={errors.issuerName?.message}>
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
      <FormField label="Apelido (opcional)" error={errors.offerName?.message}>
        {(control) => (
          <div className={fieldBox}>
            <input
              {...control}
              {...form.register('offerName')}
              type="text"
              maxLength={100}
              placeholder="Reserva de emergência"
              disabled={pending}
              className={bareInput}
            />
          </div>
        )}
      </FormField>
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

function NewOfferFieldset({
  simulation,
  options,
  pending,
  actionsRef,
}: Omit<OfferSectionProps, 'savedOffer'>) {
  const { form, values } = simulation;
  const copied = options.offers.find(
    (option) => option.id === values.copiedOfferId,
  );
  return (
    <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
      <legend className={legendClass}>
        <span className="flex items-center gap-2">
          <OfferIcon className="size-4 shrink-0" />
          {copied
            ? `Nova oferta · cópia de ${offerTermsLabel(copied)}`
            : 'Nova oferta'}
        </span>
      </legend>
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
            {(control) => (
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
            )}
          </FormField>
        )}
      />
      <OfferTermFields
        simulation={simulation}
        options={options}
        pending={pending}
      />
      <OfferConsequence tone="info">
        Será criada em Ofertas › Minhas ao salvar.
        {copied && ' A oferta original não muda.'}
      </OfferConsequence>
      <button
        type="button"
        className={`${quietButton} justify-self-start gap-2 px-0`}
        disabled={pending}
        onClick={() => {
          simulation.backToChosenOffer();
          focusLater(() => actionsRef.current?.focus());
        }}
      >
        <ChevronLeftIcon className="size-4 shrink-0" />
        {simulation.offer
          ? 'Voltar à oferta escolhida'
          : 'Usar uma oferta existente'}
      </button>
    </fieldset>
  );
}

/** How many other simulations an edit of the offer recalculates. */
function useOtherSimulationCount(
  offerId: string | undefined,
  simulationId: string | undefined,
) {
  return useOfferSimulations(offerId, {
    excludingId: simulationId,
    pageSize: 1,
  }).state;
}

function recalculationWarning(
  others: OfferSimulationsState,
  newIndex: string | null,
  changesIndex: boolean,
): string | null {
  if (others.status === 'ready' && others.total === 0) return null;
  const count =
    others.status !== 'ready'
      ? 'As outras simulações que usam esta oferta também serão recalculadas.'
      : others.total === 1
        ? 'Outra simulação que usa esta oferta também será recalculada.'
        : `Outras ${others.total} simulações que usam esta oferta também serão recalculadas.`;
  if (!changesIndex) return count;
  const fix = newIndex ? `com uma curva do ${newIndex}` : 'sem curva';
  return `${count} Como o índice muda, elas ficarão em Requer ação até que cada uma seja salva ${fix}.`;
}

function EditedOfferFieldset({
  simulation,
  options,
  savedOffer,
  pending,
  actionsRef,
  simulationId,
  offerConflict,
  onReloadOffer,
}: OfferSectionProps & {
  readonly simulationId: string | undefined;
  readonly offerConflict: boolean;
  readonly onReloadOffer: () => void;
}) {
  const { values, editedOffer } = simulation;
  const others = useOtherSimulationCount(editedOffer?.id, simulationId);
  if (!editedOffer) return null;
  // The polled workspace shows a newer offer before any save is tried.
  const changedElsewhere =
    offerConflict ||
    (savedOffer?.id === editedOffer.id &&
      savedOffer.revision > editedOffer.revision);
  const warning = simulation.recalculatesOtherSimulations
    ? recalculationWarning(others, simulation.index, simulation.changesIndex)
    : null;
  const titleType = options.titleTypes.find(
    (option) => option.titleType === values.titleType,
  );
  const closeMode = (close: () => void) => {
    close();
    focusLater(() => actionsRef.current?.focus());
  };

  return (
    <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
      <legend className={legendClass}>
        <span className="flex items-center gap-2">
          <OfferIcon className="size-4 shrink-0" />
          Oferta · Editando
        </span>
      </legend>
      <dl className="m-0 grid gap-1 text-sm">
        <dt className="text-muted">Título</dt>
        <dd className="m-0 font-medium">
          {values.titleType}
          {titleType && (
            <span className="block font-normal text-muted">
              {titleTypeHint(titleType)}
            </span>
          )}
        </dd>
      </dl>
      <OfferTermFields
        simulation={simulation}
        options={options}
        pending={pending}
      />
      {changedElsewhere && (
        <div
          role="alert"
          className="grid gap-2 rounded-control border border-error/40 bg-error-soft p-3 text-sm"
        >
          <p className="m-0">Esta oferta foi alterada em outro lugar.</p>
          <button
            type="button"
            className={`${secondaryButton} justify-self-start`}
            onClick={onReloadOffer}
          >
            <RefreshIcon className="size-4 shrink-0" />
            Recarregar oferta
          </button>
        </div>
      )}
      <div aria-live="polite">
        {warning ? (
          <OfferConsequence tone="warning">{warning}</OfferConsequence>
        ) : (
          <OfferConsequence tone="info">
            As alterações valem para a oferta em todas as simulações que a usam.
          </OfferConsequence>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <button
          type="button"
          className={`${quietButton} gap-2 px-0`}
          disabled={pending}
          onClick={() => {
            simulation.saveAsNewOffer();
            focusLater(() => simulation.form.setFocus('titleType'));
          }}
        >
          <CopyIcon className="size-4 shrink-0" />
          Salvar como nova oferta
        </button>
        <button
          type="button"
          className={`${quietButton} gap-2 px-0`}
          disabled={pending}
          onClick={() => closeMode(simulation.discardOfferEdits)}
        >
          <XIcon className="size-4 shrink-0" />
          Descartar alterações da oferta
        </button>
      </div>
    </fieldset>
  );
}

function TermsSummary({ terms }: { readonly terms: OfferTerms }) {
  // The chosen option already shows the remuneration.
  const rows: [string, string][] = [
    ['Emissor', terms.issuerName ?? 'Sem emissor'],
    ...(terms.name ? [['Apelido', terms.name] as [string, string]] : []),
    ['Vencimento', formatIsoDate(terms.maturityDate)],
    ['Liquidez', REDEMPTION_LABELS[terms.redemptionTerms.kind]],
  ];
  return (
    <section aria-label="Termos da oferta" className="grid gap-4">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  const { editedOffer, values } = simulation;
  const others = useOtherSimulationCount(editedOffer?.id, saved?.simulation.id);
  const text = (() => {
    if (values.offerMode === 'new') {
      return 'Salvar cria a oferta e calcula a simulação.';
    }
    if (editedOffer) {
      if (!simulation.recalculatesOtherSimulations) {
        return 'Salvar altera a oferta.';
      }
      if (!saved) return 'Salvar altera a oferta e cria a simulação.';
      return others.status === 'ready' && others.total > 0
        ? `Salvar altera a oferta e recalcula esta e outras ${others.total} simulações.`
        : 'Salvar altera a oferta e recalcula esta simulação.';
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
  // The edited offer was changed elsewhere, as the last save reported.
  readonly offerConflict: boolean;
  readonly onReloadOffer: () => void;
  readonly onSave: () => void;
}

export function SimulationFormPanel({
  simulation,
  options,
  saved,
  pending,
  upToDate,
  offerConflict,
  onReloadOffer,
  onSave,
}: SimulationFormPanelProps) {
  const offerActionsRef = useRef<HTMLButtonElement>(null);
  const section = {
    simulation,
    options,
    savedOffer: saved?.offer ?? null,
    pending,
    actionsRef: offerActionsRef,
  };
  const offerMode = simulation.values.offerMode;
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
      {offerMode === 'new' ? (
        <NewOfferFieldset {...section} />
      ) : offerMode === 'editing' ? (
        <EditedOfferFieldset
          {...section}
          simulationId={saved?.simulation.id}
          offerConflict={offerConflict}
          onReloadOffer={onReloadOffer}
        />
      ) : (
        <ChosenOffer {...section} />
      )}
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
