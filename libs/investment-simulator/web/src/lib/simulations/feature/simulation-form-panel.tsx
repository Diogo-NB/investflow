import { Controller } from 'react-hook-form';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  remunerationLabel,
  UNSUPPORTED_LABELS,
  type RemunerationKind,
  type TitleType,
} from '../../offers/models/offer-terms';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import { SelectField, type SelectOption } from '../../ui/select-field';
import {
  bareInput,
  fieldBox,
  primaryButton,
  quietButton,
  surface,
} from '../../ui/styles';
import type {
  OfferOption,
  SimulationOptions,
  SimulationTerms,
  TitleTypeOption,
} from '../models/simulation.types';
import type { useSimulationForm } from './use-simulation-form';

type SimulationForm = ReturnType<typeof useSimulationForm>;

const REDEMPTION_OPTIONS: SelectOption[] = (
  ['AT_MATURITY', 'DAILY'] as const
).map((kind) => ({ value: kind, label: REDEMPTION_LABELS[kind] }));

const NO_OFFER = 'none';

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

function offerOption(offer: OfferOption): SelectOption {
  return {
    value: offer.id,
    label: [
      offer.issuerName,
      `${offer.titleType} ${remunerationLabel(offer.remunerationTerms)}`,
    ]
      .filter(Boolean)
      .join(' · '),
    detail: offer.unsupportedReason
      ? UNSUPPORTED_LABELS[offer.unsupportedReason]
      : `Vence em ${formatIsoDate(offer.maturityDate)}`,
    disabled: offer.unsupportedReason !== null,
  };
}

function OfferPicker({
  simulation,
  offers,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly offers: readonly OfferOption[];
  readonly pending: boolean;
}) {
  const offerId = simulation.values.offerId;
  const selected = offers.find((offer) => offer.id === offerId);

  if (offers.length === 0) return null;

  return (
    <FormField
      label="Preencher com uma oferta (opcional)"
      hint={
        selected && simulation.termsChangedFrom(selected) ? (
          <span className="flex flex-wrap items-center gap-x-2">
            Termos alterados em relação à oferta.
            <button
              type="button"
              className={`${quietButton} min-h-0 px-0 underline`}
              onClick={() => simulation.applyOffer(selected)}
            >
              Restaurar termos da oferta
            </button>
          </span>
        ) : (
          'Os termos continuam editáveis para testar variações.'
        )
      }
    >
      {(control) => (
        <SelectField
          {...control}
          value={offerId || NO_OFFER}
          placeholder="Termos personalizados"
          disabled={pending}
          options={[
            { value: NO_OFFER, label: 'Nenhuma: termos personalizados' },
            ...offers.map(offerOption),
          ]}
          onValueChange={(value) =>
            simulation.applyOffer(
              offers.find((offer) => offer.id === value) ?? null,
            )
          }
        />
      )}
    </FormField>
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
      <legend className={legendClass}>Termos do título</legend>
      <OfferPicker
        simulation={simulation}
        offers={options.offers}
        pending={pending}
      />
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
    </fieldset>
  );
}

function TermsSummary({ terms }: { readonly terms: SimulationTerms }) {
  const rows: [string, string][] = [
    ['Emissor', terms.issuerName ?? 'Sem emissor'],
    [
      'Remuneração',
      `${terms.titleType} ${remunerationLabel(terms.remunerationTerms)}`,
    ],
    ['Vencimento', formatIsoDate(terms.maturityDate)],
    ['Liquidez', REDEMPTION_LABELS[terms.redemptionTerms.kind]],
  ];
  return (
    <section aria-labelledby="terms-title" className="grid gap-4">
      <h3
        id="terms-title"
        className="m-0 text-sm font-semibold tracking-wide text-muted uppercase"
      >
        Termos do título
      </h3>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-sm text-muted">
        Os termos são fixos nesta simulação. Para testar outros, use Duplicar.
      </p>
    </section>
  );
}

function InvestmentFieldset({
  simulation,
  pending,
}: {
  readonly simulation: SimulationForm;
  readonly pending: boolean;
}) {
  const { form, values, index, curveOptions, coverageWarning } = simulation;
  const { errors } = form.formState;
  const curveHint = (() => {
    if (coverageWarning) {
      return `A curva cobre de ${formatIsoDate(coverageWarning.startDate)} a ${formatIsoDate(coverageWarning.endDate)} e pode não alcançar todo o período.`;
    }
    const curve = curveOptions.find(
      (option) => option.id === values.indexCurveId,
    );
    return curve
      ? `Cobertura de ${formatIsoDate(curve.coverage.startDate)} a ${formatIsoDate(curve.coverage.endDate)}.`
      : undefined;
  })();

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
          name="indexCurveId"
          render={({ field, fieldState }) => (
            <FormField
              label={`Curva do ${index}`}
              error={fieldState.error?.message}
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
                  value={field.value}
                  placeholder="Escolha a curva"
                  disabled={pending || curveOptions.length === 0}
                  options={curveOptions.map((curve) => ({
                    value: curve.id,
                    label: curve.name,
                    ...(curve.description ? { detail: curve.description } : {}),
                  }))}
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
  // The saved simulation's fixed terms; null while creating one.
  readonly savedTerms: SimulationTerms | null;
  readonly pending: boolean;
  readonly upToDate: boolean;
  readonly onCalculate: () => void;
}

export function SimulationFormPanel({
  simulation,
  options,
  savedTerms,
  pending,
  upToDate,
  onCalculate,
}: SimulationFormPanelProps) {
  return (
    <form
      noValidate
      aria-labelledby="inputs-title"
      className={`${surface} grid content-start gap-6 p-6 lg:sticky lg:top-6`}
      onSubmit={(event) => {
        event.preventDefault();
        onCalculate();
      }}
    >
      <h2 id="inputs-title" className="m-0 text-lg font-semibold">
        Entradas
      </h2>
      {savedTerms ? (
        <TermsSummary terms={savedTerms} />
      ) : (
        <TermsFieldset
          simulation={simulation}
          options={options}
          pending={pending}
        />
      )}
      <InvestmentFieldset simulation={simulation} pending={pending} />

      <div className="grid gap-2 border-t border-border pt-6">
        <button
          type="submit"
          className={primaryButton}
          disabled={pending || upToDate}
        >
          {pending
            ? 'Calculando…'
            : upToDate
              ? 'Resultado atualizado'
              : 'Calcular'}
        </button>
        <p className="m-0 text-sm text-muted">
          {savedTerms
            ? 'Calcular registra um novo resultado com este investimento.'
            : 'Calcular cria a simulação e registra o resultado.'}
        </p>
      </div>
    </form>
  );
}
