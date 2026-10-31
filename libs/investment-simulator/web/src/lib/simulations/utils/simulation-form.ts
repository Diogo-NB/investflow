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
  offerEdit,
  offerTermFields,
  requiredDate,
  validatedDecimal,
  type OfferFormValues,
} from '../../offers/utils/offer-form';
import type { OfferSummary } from '../../offers/models/offer.types';
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
  // The offer the terms came from: a followed catalog offer, the simulation's
  // own offer, or blank for terms typed from scratch. Terms that differ from
  // it are saved as the simulation's own before the simulation.
  offerId: string;
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

export type SimulationField = keyof SimulationFormValues;

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

/**
 * Whether the terms differ from the offer they came from, or have none. The
 * apelido is the offer's and never changes in a simulation; the issuer changes
 * only where no offer is behind the terms.
 */
export function changesOfferTerms(
  offer: OfferSummary | undefined,
  values: SimulationFormValues,
): boolean {
  if (!offer) return true;
  if (values.titleType !== offer.titleType) return true;
  // Values not yet valid differ: only the rate and dates fail to convert.
  try {
    const edit = offerEdit(offer, offerFormValues(values));
    return Object.keys(edit).some(
      (field) => field !== 'revision' && field !== 'name',
    );
  } catch {
    return true;
  }
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
    offerId: offer.id,
    offerName: offer.name ?? '',
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

/**
 * A duplicate starts from the same choices but never shares the original's
 * own terms: it follows their base, so saving gives it its own copy.
 */
export function duplicateValues(
  workspace: SimulationWorkspace,
  remunerations: readonly RemunerationOption[],
): SimulationFormValues {
  const values = simulationValues(workspace, remunerations);
  const { offer } = workspace;
  if (offer.scope !== 'SIMULATION') return values;
  const base = offer.basedOn && !offer.basedOn.deleted ? offer.basedOn : null;
  return { ...values, offerId: base?.id ?? '' };
}

/** The term fields an offer fills; the investment itself is kept. */
export function offerTermValues(
  offer: Omit<OfferOption, 'unsupportedReason'>,
  current: Pick<SimulationFormValues, 'curveId'>,
  remunerations: readonly RemunerationOption[],
): Pick<
  SimulationFormValues,
  | 'offerName'
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
    offerName: offer.name ?? '',
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
