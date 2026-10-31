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
  validatedDecimal,
  type OfferFormValues,
} from '../../offers/utils/offer-form';
import type {
  RedemptionKind,
  RemunerationKind,
  TitleType,
} from '../../offers/models/offer-terms';
import type {
  CurveOption,
  OfferOption,
  RemunerationOption,
  SimulationInput,
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';

/**
 * What the user edits. Amounts and rates keep the typed Brazilian text; dates
 * are ISO calendar strings (or the raw text while a typed date is invalid).
 */
export interface SimulationFormValues {
  // A chosen offer, the chosen own offer's terms being edited, or terms for a
  // new private offer. Edited and new offers are saved before the simulation.
  // The term fields mirror the chosen offer in "existing" mode.
  offerMode: 'existing' | 'editing' | 'new';
  offerId: string;
  // The offer "Duplicar e ajustar" copied; blank for "Nova oferta".
  copiedOfferId: string;
  // The edited or new offer's name; unused for a chosen offer.
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

export type SimulationField = Exclude<
  keyof SimulationFormValues,
  'offerMode' | 'copiedOfferId'
>;

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
      offerMode: z.enum(['existing', 'editing', 'new']),
      offerId: z.string(),
      copiedOfferId: z.string(),
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
      if (values.offerMode !== 'new' && !values.offerId) {
        context.addIssue({
          code: 'custom',
          path: ['offerId'],
          message: 'Escolha uma oferta.',
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

/** The edited or new offer's terms, as the offer editor holds them. */
export function offerFormValues(values: SimulationFormValues): OfferFormValues {
  return {
    name: values.offerName,
    titleType: values.titleType,
    issuerName: values.issuerName,
    remunerationKind: values.remunerationKind,
    rate: values.rate,
    maturityDate: values.maturityDate,
    redemptionKind: values.redemptionKind,
  };
}

/** The form once its edited or new terms were saved as the offer with this id. */
export function savedOfferValues(
  values: SimulationFormValues,
  offerId: string,
): SimulationFormValues {
  return {
    ...values,
    offerMode: 'existing',
    offerId,
    copiedOfferId: '',
    offerName: '',
  };
}

/** Converts validated values with a chosen offer into the create or edit payload. */
export function toSimulationInput(
  values: SimulationFormValues,
): SimulationInput {
  return {
    offerId: values.offerId,
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
    copiedOfferId: '',
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

/**
 * A saved simulation's choices, also the starting point of a duplicate. A
 * saved curve the offer's index no longer takes (the offer moved to another
 * index or became prefixed) gives way to that index's default, so saving fixes
 * the simulation; a deleted one stays, so the form names it as missing.
 */
export function simulationValues(
  { offer, simulation, curve }: SimulationWorkspace,
  remunerations: readonly RemunerationOption[],
): SimulationFormValues {
  const { investment } = simulation;
  const kind = offer.remunerationTerms.kind;
  const fitsOffer =
    curve?.deleted === true ||
    (remunerationOption(remunerations, kind)?.curves ?? []).some(
      (option) => option.id === investment.curveId,
    );
  return {
    offerMode: 'existing',
    offerId: offer.id,
    copiedOfferId: '',
    offerName: '',
    principal: toBrazilianInput(investment.principal),
    investmentDate: investment.investmentDate,
    titleType: offer.titleType,
    issuerName: offer.issuerName ?? '',
    remunerationKind: kind,
    rate: toBrazilianInput(shiftDecimal(offer.remunerationTerms.rate, 2)),
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
    curveId:
      fitsOffer && investment.curveId
        ? investment.curveId
        : defaultCurveId(kind, remunerations),
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
