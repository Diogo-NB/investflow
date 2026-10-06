import {
  CreateOffer,
  Offer,
  OfferFormModel,
  RedemptionKind,
  RemunerationKind,
  UpdateOffer,
} from '../models/offer.type';

function normalize(value: string): string {
  const [integer, fraction = ''] = value.split('.');
  const whole = integer.replace(/^0+(?=\d)/, '') || '0';
  const decimals = fraction.replace(/0+$/, '');
  return decimals ? `${whole}.${decimals}` : whole;
}

// Move the decimal point using strings: Number/Decimal's default precision can round long rates.
function shiftDecimal(value: string, places: number): string {
  const [integer, fraction = ''] = value.split('.');
  const digits = integer + fraction;
  const point = integer.length + places;
  if (point <= 0) return normalize(`0.${'0'.repeat(-point)}${digits}`);
  if (point >= digits.length)
    return normalize(digits + '0'.repeat(point - digits.length));
  return normalize(`${digits.slice(0, point)}.${digits.slice(point)}`);
}

export function percentageToRate(input: string): string | undefined {
  const value = input.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined;
  const rate = shiftDecimal(normalize(value), -2);
  const [integer, fraction = ''] = rate.split('.');
  if (rate === '0' || integer.length > 35 || fraction.length > 30)
    return undefined;
  return rate;
}

export function rateToPercentage(rate: string): string {
  return shiftDecimal(rate, 2);
}
export function percentageLabel(value: string): string {
  return value.replace('.', ',');
}
export function formatCalendarDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export const redemptionOptions: ReadonlyArray<{
  value: RedemptionKind;
  label: string;
}> = [
  { value: 'DAILY', label: 'Diário' },
  { value: 'AT_MATURITY', label: 'No vencimento' },
];
export const remunerationOptions: ReadonlyArray<{
  value: RemunerationKind;
  label: string;
  unit: string;
  hint: string;
}> = [
  {
    value: 'PREFIXED',
    label: 'Prefixada',
    unit: '% ao ano',
    hint: 'Informe a taxa anual contratada. Exemplo: 12 para 12% ao ano.',
  },
  {
    value: 'CDI_PERCENTAGE',
    label: 'Percentual do CDI',
    unit: '% do CDI',
    hint: 'Informe o percentual contratado. Exemplo: 110 para 110% do CDI.',
  },
  {
    value: 'SELIC_PERCENTAGE',
    label: 'Percentual da SELIC',
    unit: '% da SELIC',
    hint: 'Informe o percentual contratado. Exemplo: 100 para 100% da SELIC.',
  },
  {
    value: 'IPCA_PLUS',
    label: 'IPCA + taxa fixa',
    unit: '% ao ano + IPCA',
    hint: 'Informe apenas a parcela fixa anual. Exemplo: 6 para IPCA + 6% ao ano.',
  },
];
export function formatRedemption(kind: RedemptionKind): string {
  return kind === 'DAILY' ? 'Diário' : 'No vencimento';
}
export function formatRemuneration(terms: Offer['remunerationTerms']): string {
  const value = percentageLabel(rateToPercentage(terms.rate));
  switch (terms.kind) {
    case 'PREFIXED':
      return `${value}% ao ano`;
    case 'CDI_PERCENTAGE':
      return `${value}% do CDI`;
    case 'SELIC_PERCENTAGE':
      return `${value}% da SELIC`;
    case 'IPCA_PLUS':
      return `IPCA + ${value}% ao ano`;
  }
}
export function emptyOfferModel(): OfferFormModel {
  return {
    titleType: '',
    issuerId: '',
    maturityDate: '',
    redemptionKind: '',
    remunerationKind: '',
    percentage: '',
  };
}
export function offerToModel(offer: Offer): OfferFormModel {
  return {
    titleType: offer.titleType,
    issuerId: offer.issuer.id,
    maturityDate: offer.maturityDate,
    redemptionKind: offer.redemptionTerms.kind,
    remunerationKind: offer.remunerationTerms.kind,
    percentage: percentageLabel(rateToPercentage(offer.remunerationTerms.rate)),
  };
}
export function toCreateOffer(model: OfferFormModel): CreateOffer {
  const rate = percentageToRate(model.percentage);
  if (
    !model.titleType ||
    !model.redemptionKind ||
    !model.remunerationKind ||
    !model.issuerId ||
    !isCalendarDate(model.maturityDate) ||
    !rate
  )
    throw new Error('Invalid offer form');
  return {
    titleType: model.titleType,
    issuerId: model.issuerId,
    maturityDate: model.maturityDate,
    redemptionTerms: { kind: model.redemptionKind },
    remunerationTerms: { kind: model.remunerationKind, rate },
  };
}
export function toUpdateOffer(
  model: OfferFormModel,
  original: Offer,
): UpdateOffer {
  const current = toCreateOffer(model);
  return {
    ...(current.maturityDate !== original.maturityDate
      ? { maturityDate: current.maturityDate }
      : {}),
    ...(current.redemptionTerms.kind !== original.redemptionTerms.kind
      ? { redemptionTerms: current.redemptionTerms }
      : {}),
    ...(current.remunerationTerms.kind !== original.remunerationTerms.kind ||
    current.remunerationTerms.rate !==
      normalize(original.remunerationTerms.rate)
      ? { remunerationTerms: current.remunerationTerms }
      : {}),
  };
}
export function modelChanged(
  model: OfferFormModel,
  original: OfferFormModel,
): boolean {
  return Object.keys(model).some((key) => {
    const field = key as keyof OfferFormModel;
    if (field === 'percentage') {
      const current = percentageToRate(model.percentage);
      const previous = percentageToRate(original.percentage);
      return current && previous
        ? current !== previous
        : model.percentage !== original.percentage;
    }
    return model[field] !== original[field];
  });
}
