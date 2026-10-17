import { shiftDecimal } from './decimal-string';

// Intl formats numeric strings exactly, rounding only the displayed digits.
type NumericString = `${number}`;

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percent = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 4,
});

const returnPercent = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(decimal: string): string {
  return money.format(decimal as NumericString);
}

/** Formats a fraction as a percentage number: "1.1" → "110", "0.125" → "12,5". */
export function formatPercentOf(fraction: string): string {
  return percent.format(shiftDecimal(fraction, 2) as NumericString);
}

export function formatReturnPercent(fraction: string): string {
  return `${returnPercent.format(shiftDecimal(fraction, 2) as NumericString)}%`;
}
