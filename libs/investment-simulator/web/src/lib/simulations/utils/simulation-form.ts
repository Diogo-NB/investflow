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
  TitleType,
} from '../../offers/models/offer-terms';
import type {
  CurveOption,
  Investment,
  OfferOption,
  RemunerationOption,
  SimulationOptions,
  SimulationTerms,
  StartSimulationInput,
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
  titleType: TitleType;
  // Blank when the terms have no issuer.
  issuerName: string;
  remunerationKind: RemunerationKind;
  // Percentage in the kind's unit: "110" (% do CDI) or "12,5" (% a.a.).
  rate: string;
  maturityDate: string;
  redemptionKind: RedemptionKind;
  curveId: string;
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
      titleType: z.enum(['CDB', 'LCI', 'LCA']),
      issuerName: z.string().max(100, 'Use até 100 caracteres.'),
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
      curveId: z.string(),
    })
    .superRefine((values, context) => {
      if (
        remunerationOption(remunerations, values.remunerationKind)?.index &&
        !values.curveId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['curveId'],
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

function validatedDecimal(text: string): string {
  const parsed = parseBrazilianDecimal(text);
  if (parsed === null) throw new Error('Form values must be validated first');
  return parsed;
}

/**
 * Converts validated form values into the API's start payload. A saved
 * simulation sends only `investment`; its terms are fixed.
 */
export function toSimulationInput(
  values: SimulationFormValues,
): StartSimulationInput {
  return {
    ...(values.offerId ? { offerId: values.offerId } : {}),
    terms: {
      titleType: values.titleType,
      issuerName: values.issuerName.trim() || null,
      maturityDate: values.maturityDate,
      redemptionTerms: { kind: values.redemptionKind },
      remunerationTerms: {
        kind: values.remunerationKind,
        rate: shiftDecimal(validatedDecimal(values.rate), -2),
      },
    },
    investment: {
      principal: validatedDecimal(values.principal),
      investmentDate: values.investmentDate,
      curveId: values.curveId || null,
    },
  };
}

/** The only visible curve the kind accepts, chosen for the user. */
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
    titleType: 'CDB',
    issuerName: '',
    remunerationKind: 'CDI_PERCENTAGE',
    rate: '',
    maturityDate: '',
    redemptionKind: 'AT_MATURITY',
    curveId: defaultCurveId('CDI_PERCENTAGE', options.remunerations),
  };
}

export function simulationValues(
  terms: SimulationTerms,
  investment: Investment,
): SimulationFormValues {
  return {
    offerId: '',
    principal: toBrazilianInput(investment.principal),
    investmentDate: investment.investmentDate,
    titleType: terms.titleType,
    issuerName: terms.issuerName ?? '',
    remunerationKind: terms.remunerationTerms.kind,
    rate: toBrazilianInput(shiftDecimal(terms.remunerationTerms.rate, 2)),
    maturityDate: terms.maturityDate,
    redemptionKind: terms.redemptionTerms.kind,
    curveId: investment.curveId ?? '',
  };
}

/** The term fields a catalog offer fills; the investment itself is kept. */
export function offerTermValues(
  offer: OfferOption,
  current: Pick<SimulationFormValues, 'curveId'>,
  remunerations: readonly RemunerationOption[],
): Pick<
  SimulationFormValues,
  | 'titleType'
  | 'issuerName'
  | 'remunerationKind'
  | 'rate'
  | 'maturityDate'
  | 'redemptionKind'
  | 'curveId'
> {
  const kind = offer.remunerationTerms.kind;
  const keepsCurve = (
    remunerationOption(remunerations, kind)?.curves ?? []
  ).some((curve) => curve.id === current.curveId);
  return {
    titleType: offer.titleType,
    issuerName: offer.issuerName ?? '',
    remunerationKind: kind,
    rate: toBrazilianInput(shiftDecimal(offer.remunerationTerms.rate, 2)),
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
    curveId: keepsCurve ? current.curveId : defaultCurveId(kind, remunerations),
  };
}

export function differsFromOffer(
  values: SimulationFormValues,
  offer: OfferOption,
): boolean {
  const rate = parseBrazilianDecimal(values.rate);
  return (
    values.titleType !== offer.titleType ||
    values.issuerName.trim() !== (offer.issuerName ?? '') ||
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
