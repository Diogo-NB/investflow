import { formatPercentOf } from '../../decimals/format-decimal';

export type TitleType = 'CDB' | 'LCI' | 'LCA';
export type RedemptionKind = 'AT_MATURITY' | 'DAILY';
export type RemunerationKind =
  | 'PREFIXED'
  | 'CDI_PERCENTAGE'
  | 'SELIC_PERCENTAGE'
  | 'IPCA_PLUS';
export type EconomicIndex = 'CDI' | 'SELIC' | 'IPCA';
export type UnsupportedReason =
  | 'INVESTMENT_TITLE_UNSUPPORTED'
  | 'INVESTMENT_REMUNERATION_UNSUPPORTED';

export interface RemunerationTerms {
  readonly kind: RemunerationKind;
  // Decimal fraction: 0.12 is 12% a.a., 1.1 is 110% of the index.
  readonly rate: string;
}

export const RATE_UNITS: Record<RemunerationKind, string> = {
  PREFIXED: '% ao ano',
  CDI_PERCENTAGE: '% do CDI',
  SELIC_PERCENTAGE: '% da SELIC',
  IPCA_PLUS: '% ao ano + IPCA',
};

export const REMUNERATION_LABELS: Record<RemunerationKind, string> = {
  PREFIXED: 'Prefixado',
  CDI_PERCENTAGE: '% do CDI',
  SELIC_PERCENTAGE: '% da SELIC',
  IPCA_PLUS: 'IPCA+',
};

export const UNSUPPORTED_LABELS: Record<UnsupportedReason, string> = {
  INVESTMENT_TITLE_UNSUPPORTED: 'Só CDBs podem ser calculados',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'IPCA+ ainda não pode ser calculado',
};

export const REDEMPTION_LABELS: Record<RedemptionKind, string> = {
  DAILY: 'Diária',
  AT_MATURITY: 'No vencimento',
};

export function remunerationLabel({ kind, rate }: RemunerationTerms): string {
  const percent = formatPercentOf(rate);
  switch (kind) {
    case 'PREFIXED':
      return `${percent}% a.a.`;
    case 'CDI_PERCENTAGE':
      return `${percent}% do CDI`;
    case 'SELIC_PERCENTAGE':
      return `${percent}% da SELIC`;
    case 'IPCA_PLUS':
      return `IPCA + ${percent}% a.a.`;
  }
}
