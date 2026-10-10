import { z } from 'zod';
import { isIsoDate, previousDay } from '../../dates/calendar-date';
import {
  fitsDecimalStorage,
  isPositiveDecimal,
  parseBrazilianDecimal,
  shiftDecimal,
  toBrazilianInput,
} from '../../decimals/decimal-string';
import type {
  RedemptionKind,
  RemunerationKind,
} from '../../offers/models/offer-terms';
import type {
  CreateSimulationInput,
  CurveOption,
  OfferOption,
  RemunerationOption,
  CalculationInputs,
  SimulationOptions,
} from '../models/simulation.types';

/**
 * What the user edits. Amounts and rates keep the typed Brazilian text; dates
 * are ISO calendar strings (or the raw text while a typed date is invalid).
 */
export interface SimulationFormValues {
  // Catalog offer that filled the terms; only a new simulation can use one.
  offerId: string;
  principal: string;
  investmentDate: string;
  issuerId: string;
  remunerationKind: RemunerationKind;
  // Percentage in the kind's unit: "110" (% do CDI) or "12,5" (% a.a.).
  rate: string;
  maturityDate: string;
  redemptionKind: RedemptionKind;
  indexCurveId: string;
}

export type SimulationField = Exclude<keyof SimulationFormValues, 'offerId'>;

// Refinements don't abort, so object-level rules still run; each one passes
// what an earlier refinement already reports to keep one message per field.
const requiredDate = z
  .string()
  .refine((value) => value !== '', 'Informe a data.')
  .refine(
    (value) => value === '' || isIsoDate(value),
    'Informe uma data válida no formato DD/MM/AAAA.',
  );

function decimalText(empty: string, positive: string) {
  return z
    .string()
    .refine((value) => value.trim() !== '', empty)
    .refine(
      (value) => value.trim() === '' || parseBrazilianDecimal(value) !== null,
      'Use apenas números, como 10.000,50.',
    )
    .refine((value) => {
      const decimal = parseBrazilianDecimal(value);
      return decimal === null || isPositiveDecimal(decimal);
    }, positive);
}

/** The remuneration option of a kind; every kind is listed by the API. */
export function remunerationOption(
  remunerations: readonly RemunerationOption[],
  kind: RemunerationKind,
): RemunerationOption | undefined {
  return remunerations.find((option) => option.kind === kind);
}

export function simulationFormSchema(
  remunerations: readonly RemunerationOption[],
) {
  return z
    .object({
      offerId: z.string(),
      principal: decimalText(
        'Informe o valor aplicado.',
        'O valor aplicado deve ser maior que zero.',
      ).refine((value) => {
        const decimal = parseBrazilianDecimal(value);
        return decimal === null || fitsDecimalStorage(decimal);
      }, 'Valor grande demais.'),
      investmentDate: requiredDate,
      issuerId: z.string().min(1, 'Escolha o emissor.'),
      remunerationKind: z.enum([
        'PREFIXED',
        'CDI_PERCENTAGE',
        'SELIC_PERCENTAGE',
        'IPCA_PLUS',
      ]),
      rate: decimalText(
        'Informe a taxa.',
        'A taxa deve ser maior que zero.',
      ).refine((value) => {
        const decimal = parseBrazilianDecimal(value);
        return (
          decimal === null || fitsDecimalStorage(shiftDecimal(decimal, -2))
        );
      }, 'Taxa com casas decimais demais.'),
      maturityDate: requiredDate,
      redemptionKind: z.enum(['AT_MATURITY', 'DAILY']),
      indexCurveId: z.string(),
    })
    .superRefine((values, context) => {
      if (
        remunerationOption(remunerations, values.remunerationKind)?.index &&
        !values.indexCurveId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['indexCurveId'],
          message: 'Escolha a curva do índice.',
        });
      }
      if (
        isIsoDate(values.investmentDate) &&
        isIsoDate(values.maturityDate) &&
        values.maturityDate <= values.investmentDate
      ) {
        context.addIssue({
          code: 'custom',
          path: ['maturityDate'],
          message: 'O vencimento deve ser depois da data da aplicação.',
        });
      }
    });
}

/**
 * Converts validated form values into the API's full-terms payload. The curve
 * is sent only while the chosen kind accepts one (fixed rates have none).
 */
export function toSimulationInput(
  values: SimulationFormValues,
): CreateSimulationInput {
  const decimal = (text: string) => {
    const parsed = parseBrazilianDecimal(text);
    if (parsed === null) throw new Error('Form values must be validated first');
    return parsed;
  };
  return {
    ...(values.offerId ? { offerId: values.offerId } : {}),
    principal: decimal(values.principal),
    investmentDate: values.investmentDate,
    indexCurveId: values.indexCurveId || null,
    issuerId: values.issuerId,
    maturityDate: values.maturityDate,
    redemptionTerms: { kind: values.redemptionKind },
    remunerationTerms: {
      kind: values.remunerationKind,
      rate: shiftDecimal(decimal(values.rate), -2),
    },
  };
}

/** The only live curve the kind accepts, chosen for the user. */
export function defaultCurveId(
  kind: RemunerationKind,
  remunerations: readonly RemunerationOption[],
): string {
  const curves = remunerationOption(remunerations, kind)?.curves ?? [];
  return curves.length === 1 ? curves[0].id : '';
}

export function blankSimulationValues(
  today: string,
  options: SimulationOptions,
): SimulationFormValues {
  return {
    offerId: '',
    principal: '',
    investmentDate: today,
    issuerId: options.issuers.length === 1 ? options.issuers[0].id : '',
    remunerationKind: 'CDI_PERCENTAGE',
    rate: '',
    maturityDate: '',
    redemptionKind: 'AT_MATURITY',
    indexCurveId: defaultCurveId('CDI_PERCENTAGE', options.remunerations),
  };
}

export function simulationValues(
  inputs: CalculationInputs,
): SimulationFormValues {
  return {
    offerId: '',
    principal: toBrazilianInput(inputs.principal),
    investmentDate: inputs.investmentDate,
    issuerId: inputs.issuer.id,
    remunerationKind: inputs.remunerationTerms.kind,
    rate: toBrazilianInput(shiftDecimal(inputs.remunerationTerms.rate, 2)),
    maturityDate: inputs.maturityDate,
    redemptionKind: inputs.redemptionTerms.kind,
    indexCurveId: inputs.indexCurveId ?? '',
  };
}

/** The term fields a catalog offer fills; the investment itself is kept. */
export function offerTermValues(
  offer: OfferOption,
  current: Pick<SimulationFormValues, 'indexCurveId'>,
  remunerations: readonly RemunerationOption[],
): Pick<
  SimulationFormValues,
  | 'issuerId'
  | 'remunerationKind'
  | 'rate'
  | 'maturityDate'
  | 'redemptionKind'
  | 'indexCurveId'
> {
  const kind = offer.remunerationTerms.kind;
  const keepsCurve = (
    remunerationOption(remunerations, kind)?.curves ?? []
  ).some((curve) => curve.id === current.indexCurveId);
  return {
    issuerId: offer.issuer.id,
    remunerationKind: kind,
    rate: toBrazilianInput(shiftDecimal(offer.remunerationTerms.rate, 2)),
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
    indexCurveId: keepsCurve
      ? current.indexCurveId
      : defaultCurveId(kind, remunerations),
  };
}

export function differsFromOffer(
  values: SimulationFormValues,
  offer: OfferOption,
): boolean {
  const rate = parseBrazilianDecimal(values.rate);
  return (
    values.issuerId !== offer.issuer.id ||
    values.remunerationKind !== offer.remunerationTerms.kind ||
    rate === null ||
    shiftDecimal(rate, -2) !== shiftDecimal(offer.remunerationTerms.rate, 0) ||
    values.maturityDate !== offer.maturityDate ||
    values.redemptionKind !== offer.redemptionTerms.kind
  );
}

export function coverageGap(
  values: Pick<SimulationFormValues, 'investmentDate' | 'maturityDate'>,
  curve: CurveOption | undefined,
): CurveOption['coverage'] | null {
  if (
    !curve ||
    !isIsoDate(values.investmentDate) ||
    !isIsoDate(values.maturityDate)
  ) {
    return null;
  }
  // Rates are referenced from the investment date up to the day before maturity.
  return values.investmentDate < curve.coverage.startDate ||
    previousDay(values.maturityDate) > curve.coverage.endDate
    ? curve.coverage
    : null;
}
