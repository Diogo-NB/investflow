import { Controller } from 'react-hook-form';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  UNSUPPORTED_LABELS,
  type RemunerationKind,
  type TitleType,
} from '../../offers/models/offer-terms';
import {
  offerSelectGroups,
  ORIGIN_LABELS,
} from '../../offers/utils/offer-groups';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import { SelectField, type SelectOption } from '../../ui/select-field';
import {
  CheckCircleIcon,
  CurveIcon,
  OfferIcon,
  SpinningRefreshIcon,
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

function ChosenOffer({
  simulation,
  options,
  savedOffer,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly savedOffer: SimulationWorkspace['offer'] | null;
  readonly pending: boolean;
}) {
  const { offer } = simulation;
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
        <button
          type="button"
          className={secondaryButton}
          disabled={pending || !offer}
          onClick={simulation.duplicateOffer}
        >
          Duplicar e ajustar
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={simulation.typeTerms}
        >
          Digitar termos
        </button>
      </div>
      <p className="m-0 text-sm text-muted">
        Para usar outros termos, duplique a oferta ou digite novos; a nova
        oferta fica em Minhas e é criada ao salvar.
      </p>
    </fieldset>
  );
}

function TermsFieldset({
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
    <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
      <legend className={legendClass}>
        <span className="flex items-center gap-2">
          <OfferIcon className="size-4 shrink-0" />
          Nova oferta
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
      <button
        type="button"
        className={`${quietButton} justify-self-start px-0`}
        disabled={pending}
        onClick={simulation.backToChosenOffer}
      >
        Usar uma oferta existente
      </button>
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

interface SimulationFormPanelProps {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  // The saved simulation; null while creating one.
  readonly saved: SimulationWorkspace | null;
  readonly pending: boolean;
  readonly upToDate: boolean;
  readonly onSave: () => void;
}

export function SimulationFormPanel({
  simulation,
  options,
  saved,
  pending,
  upToDate,
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
      {simulation.values.offerMode === 'new' ? (
        <TermsFieldset
          simulation={simulation}
          options={options}
          pending={pending}
        />
      ) : (
        <ChosenOffer
          simulation={simulation}
          options={options}
          savedOffer={saved?.offer ?? null}
          pending={pending}
        />
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
        <p className="m-0 text-sm text-muted">
          {saved
            ? 'Salvar recalcula o resultado com a oferta e a curva atuais.'
            : 'Salvar cria a simulação e calcula o resultado.'}
        </p>
      </div>
    </form>
  );
}
