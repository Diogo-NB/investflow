import { z } from 'zod';
import {
  isInAcceptedYears,
  outsideAcceptedYearsMessage,
} from '../../business-calendar/business-calendar';
import { isIsoDate, todayInSaoPaulo } from '../../dates/calendar-date';
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
} from '../models/offer-terms';
import type {
  OfferEdit,
  OfferSummary,
  OfferTermsInput,
} from '../models/offer.types';

// Refinements don't abort, so object-level rules still run; each one passes
// what an earlier refinement already reports to keep one message per field.
export const requiredDate = z
  .string()
  .refine((value) => value !== '', 'Informe a data.')
  .refine(
    (value) => value === '' || isIsoDate(value),
    'Informe uma data válida no formato DD/MM/AAAA.',
  )
  .refine(
    (value) => !isIsoDate(value) || isInAcceptedYears(value, todayInSaoPaulo()),
    { error: () => outsideAcceptedYearsMessage(todayInSaoPaulo()) },
  );

export function decimalText(empty: string, positive: string) {
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

export function validatedDecimal(text: string): string {
  const parsed = parseBrazilianDecimal(text);
  if (parsed === null) throw new Error('Form values must be validated first');
  return parsed;
}

/** The fields every offer's terms are typed with, in any form. */
export const offerTermFields = {
  titleType: z.enum(['CDB', 'LCI', 'LCA']),
  issuerName: z.string().max(100, 'Use até 100 caracteres.'),
  remunerationKind: z.enum([
    'PREFIXED',
    'CDI_PERCENTAGE',
    'SELIC_PERCENTAGE',
    'IPCA_PLUS',
  ]),
  // Percentage in the kind's unit: "110" (% do CDI) or "12,5" (% a.a.).
  rate: decimalText(
    'Informe a taxa.',
    'A taxa deve ser maior que zero.',
  ).refine((value) => {
    const decimal = parseBrazilianDecimal(value);
    return decimal === null || fitsDecimalStorage(shiftDecimal(decimal, -2));
  }, 'Taxa com casas decimais demais.'),
  maturityDate: requiredDate,
  redemptionKind: z.enum(['AT_MATURITY', 'DAILY']),
};

export interface OfferFormValues {
  name: string;
  titleType: TitleType;
  // Blank when the offer has no issuer.
  issuerName: string;
  remunerationKind: RemunerationKind;
  rate: string;
  maturityDate: string;
  redemptionKind: RedemptionKind;
}

export type OfferField = keyof OfferFormValues;

export const offerFormSchema = z.object({
  name: z
    .string()
    .refine((value) => value.trim() !== '', 'Informe o nome da oferta.')
    .refine((value) => value.length <= 100, 'Use até 100 caracteres.'),
  ...offerTermFields,
});

export function blankOfferValues(): OfferFormValues {
  return {
    name: '',
    titleType: 'CDB',
    issuerName: '',
    remunerationKind: 'CDI_PERCENTAGE',
    rate: '',
    maturityDate: '',
    redemptionKind: 'AT_MATURITY',
  };
}

export function offerValues(offer: OfferSummary): OfferFormValues {
  return {
    name: offer.name,
    titleType: offer.titleType,
    issuerName: offer.issuerName ?? '',
    remunerationKind: offer.remunerationTerms.kind,
    rate: toBrazilianInput(shiftDecimal(offer.remunerationTerms.rate, 2)),
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
  };
}

/** Converts validated form values into the offer's terms. */
export function toOfferInput(values: OfferFormValues): OfferTermsInput {
  return {
    titleType: values.titleType,
    name: values.name.trim(),
    issuerName: values.issuerName.trim() || null,
    maturityDate: values.maturityDate,
    redemptionTerms: { kind: values.redemptionKind },
    remunerationTerms: {
      kind: values.remunerationKind,
      rate: shiftDecimal(validatedDecimal(values.rate), -2),
    },
  };
}

/**
 * The fields that differ from the offer the editor started from. Both sides
 * go through the same conversion, so equal values compare equal however they
 * were typed.
 */
export function offerEdit(
  baseline: OfferSummary,
  values: OfferFormValues,
): OfferEdit {
  const before = toOfferInput(offerValues(baseline));
  const after = toOfferInput(values);
  const changed = (field: keyof OfferTermsInput) =>
    JSON.stringify(before[field]) !== JSON.stringify(after[field]);
  return {
    revision: baseline.revision,
    ...(changed('name') ? { name: after.name } : {}),
    ...(changed('issuerName') ? { issuerName: after.issuerName } : {}),
    ...(changed('maturityDate') ? { maturityDate: after.maturityDate } : {}),
    ...(changed('redemptionTerms')
      ? { redemptionTerms: after.redemptionTerms }
      : {}),
    ...(changed('remunerationTerms')
      ? { remunerationTerms: after.remunerationTerms }
      : {}),
  };
}

/**
 * Whether saving would change what a calculation reads (maturity,
 * remuneration). Values not yet valid count as a change: only the rate and
 * dates fail to convert, and both are terms.
 */
export function changesOfferTerms(
  baseline: OfferSummary,
  values: OfferFormValues,
): boolean {
  try {
    const edit = offerEdit(baseline, values);
    return 'maturityDate' in edit || 'remunerationTerms' in edit;
  } catch {
    return true;
  }
}
