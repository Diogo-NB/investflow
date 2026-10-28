import { z } from 'zod';
import { isIsoDate } from '../../dates/calendar-date';
import {
  fitsDecimalStorage,
  parseBrazilianDecimal,
  shiftDecimal,
  toBrazilianInput,
} from '../../decimals/decimal-string';
import {
  decimalText,
  offerTermFields,
  requiredDate,
  toOfferInput,
  validatedDecimal,
} from '../../offers/utils/offer-form';
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
  SimulationInput,
  SimulationOptions,
} from '../models/simulation.types';

/**
 * What the user edits. Amounts and rates keep the typed Brazilian text; dates
 * are ISO calendar strings (or the raw text while a typed date is invalid).
 */
export interface SimulationFormValues {
  // A visible offer, or terms typed for a new private offer saved with the
  // simulation. The term fields mirror the chosen offer in "existing" mode.
  offerMode: 'existing' | 'new';
  offerId: string;
  // The new offer's name; unused for an existing offer.
  offerName: string;
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

export type SimulationField = Exclude<keyof SimulationFormValues, 'offerMode'>;

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
      offerMode: z.enum(['existing', 'new']),
      offerId: z.string(),
      offerName: z.string().max(100, 'Use até 100 caracteres.'),
      principal: decimalText(
        'Informe o valor aplicado.',
        'O valor aplicado deve ser maior que zero.',
      ).refine((value) => {
        const decimal = parseBrazilianDecimal(value);
        return decimal === null || fitsDecimalStorage(decimal);
      }, 'Valor grande demais.'),
      investmentDate: requiredDate,
      ...offerTermFields,
      curveId: z.string(),
    })
    .superRefine((values, context) => {
      if (values.offerMode === 'existing' && !values.offerId) {
        context.addIssue({
          code: 'custom',
          path: ['offerId'],
          message: 'Escolha uma oferta.',
        });
      }
      if (values.offerMode === 'new' && !values.offerName.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['offerName'],
          message: 'Informe o nome da oferta.',
        });
      }
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

/** Converts validated form values into the API's create or edit payload. */
export function toSimulationInput(
  values: SimulationFormValues,
): SimulationInput {
  return {
    offer:
      values.offerMode === 'existing'
        ? { id: values.offerId }
        : { new: toOfferInput({ ...values, name: values.offerName }) },
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
    offerMode: 'existing',
    offerId: '',
    offerName: '',
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

/** A saved simulation's choices, also the starting point of a duplicate. */
export function simulationValues(
  offer: Omit<OfferOption, 'unsupportedReason'>,
  investment: Investment,
): SimulationFormValues {
  return {
    offerMode: 'existing',
    offerId: offer.id,
    offerName: '',
    principal: toBrazilianInput(investment.principal),
    investmentDate: investment.investmentDate,
    titleType: offer.titleType,
    issuerName: offer.issuerName ?? '',
    remunerationKind: offer.remunerationTerms.kind,
    rate: toBrazilianInput(shiftDecimal(offer.remunerationTerms.rate, 2)),
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
    curveId: investment.curveId ?? '',
  };
}

/** The term fields an offer fills; the investment itself is kept. */
export function offerTermValues(
  offer: Omit<OfferOption, 'unsupportedReason'>,
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

// The first rate is referenced on the investment date; after the curve's
// end, its last value holds onwards.
export function startsBeforeCurve(
  investmentDate: string,
  curve: CurveOption | undefined,
): boolean {
  return (
    curve !== undefined &&
    isIsoDate(investmentDate) &&
    investmentDate < curve.coverage.startDate
  );
}
