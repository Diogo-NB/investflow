import { Controller } from 'react-hook-form';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  RATE_UNITS,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  remunerationLabel,
  UNSUPPORTED_LABELS,
  type RemunerationKind,
} from '../../offers/models/offer-terms';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { DecimalInput } from '../../ui/decimal-input';
import { FormField } from '../../ui/form-field';
import { SelectField, type SelectOption } from '../../ui/select-field';
import { primaryButton, quietButton, surface } from '../../ui/styles';
import type {
  OfferOption,
  SimulationOptions,
} from '../models/simulation.types';
import type { useSimulationForm } from './use-simulation-form';

type SimulationForm = ReturnType<typeof useSimulationForm>;

const REDEMPTION_OPTIONS: SelectOption[] = (
  ['AT_MATURITY', 'DAILY'] as const
).map((kind) => ({ value: kind, label: REDEMPTION_LABELS[kind] }));

const NO_OFFER = 'none';

function offerOption(offer: OfferOption): SelectOption {
  return {
    value: offer.id,
    label: `${offer.issuer.name} · ${offer.titleType} ${remunerationLabel(offer.remunerationTerms)}`,
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

interface SimulationFormPanelProps {
  readonly simulation: SimulationForm;
  readonly options: SimulationOptions;
  readonly isNew: boolean;
  readonly pending: boolean;
  readonly upToDate: boolean;
  readonly onCalculate: () => void;
}

export function SimulationFormPanel({
  simulation,
  options,
  isNew,
  pending,
  upToDate,
  onCalculate,
}: SimulationFormPanelProps) {
  const { form, values, index, curveOptions, coverageWarning } = simulation;
  const { errors } = form.formState;
  const kind = values.remunerationKind;
  // Kinds the calculator cannot price stay visible, so saved simulations show
  // their kind, but cannot be chosen.
  const kindOptions: SelectOption[] = options.remunerations.map((option) => ({
    value: option.kind,
    label: REMUNERATION_LABELS[option.kind],
    ...(option.unsupportedReason
      ? { disabled: true, detail: UNSUPPORTED_LABELS[option.unsupportedReason] }
      : {}),
  }));
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
      <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
        <legend className="mb-4 p-0 text-sm font-semibold tracking-wide text-muted uppercase">
          Investimento
        </legend>
        <FormField
          label="Valor aplicado (R$)"
          error={errors.principal?.message}
        >
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
      </fieldset>

      <fieldset
        disabled={pending}
        className="m-0 grid gap-4 border-0 border-t border-border p-0 pt-6"
      >
        <legend className="float-left mb-4 w-full p-0 text-sm font-semibold tracking-wide text-muted uppercase">
          Termos do CDB
        </legend>
        {isNew && (
          <OfferPicker
            simulation={simulation}
            offers={options.offers}
            pending={pending}
          />
        )}
        <Controller
          control={form.control}
          name="issuerId"
          render={({ field, fieldState }) => (
            <FormField label="Emissor" error={fieldState.error?.message}>
              {(control) => (
                <SelectField
                  {...control}
                  ref={field.ref}
                  value={field.value}
                  placeholder="Escolha o emissor"
                  disabled={pending}
                  options={options.issuers.map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
          )}
        />
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

      {index && (
        <fieldset
          disabled={pending}
          className="m-0 grid gap-4 border-0 border-t border-border p-0 pt-6"
        >
          <legend className="float-left mb-4 w-full p-0 text-sm font-semibold tracking-wide text-muted uppercase">
            Índice
          </legend>
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
                      ...(curve.description
                        ? { detail: curve.description }
                        : {}),
                    }))}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </FormField>
            )}
          />
        </fieldset>
      )}

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
          {isNew
            ? 'Calcular salva a simulação e registra o resultado.'
            : 'Calcular salva as alterações e registra um novo resultado.'}
        </p>
      </div>
    </form>
  );
}
